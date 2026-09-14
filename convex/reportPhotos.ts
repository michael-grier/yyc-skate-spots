import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { requireIdentity, requireUnblockedIdentity } from "./auth";

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_UPLOADS = 6;

async function uploadFor(ctx: MutationCtx, storageId: Id<"_storage">) {
  return await ctx.db
    .query("reportUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
}

/** Report uploads use their own ledger, so public spot uploads cannot claim evidence. */
export const recordUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await requireUnblockedIdentity(ctx);
    const pending = await ctx.db
      .query("reportUploads")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", identity.tokenIdentifier))
      .take(MAX_PENDING_UPLOADS);
    if (pending.length >= MAX_PENDING_UPLOADS)
      throw new Error("Too many pending report photos. Try again later.");
    await ctx.db.insert("reportUploads", { storageId, uploadedBy: identity.tokenIdentifier });
    await ctx.scheduler.runAfter(UPLOAD_TTL_MS, internal.reportPhotos.expireUpload, { storageId });
    return null;
  },
});

/** A submitted photo has no pending row, so expiration cannot delete active evidence. */
export const expireUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const pending = await uploadFor(ctx, storageId);
    if (pending) {
      await ctx.storage.delete(storageId);
      await ctx.db.delete("reportUploads", pending._id);
    }
    return null;
  },
});

export const discardUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const identity = await requireIdentity(ctx);
    const pending = await uploadFor(ctx, storageId);
    if (!pending) return null;
    if (pending.uploadedBy !== identity.tokenIdentifier)
      throw new Error("That is not your report photo.");
    await ctx.storage.delete(storageId);
    await ctx.db.delete("reportUploads", pending._id);
    return null;
  },
});

/** Consume only the caller's fresh evidence in the report-creation transaction. */
export async function claimReportPhotos(
  ctx: MutationCtx,
  owner: string,
  photoIds: Id<"_storage">[],
) {
  for (const storageId of photoIds) {
    const pending = await uploadFor(ctx, storageId);
    if (!pending || pending.uploadedBy !== owner)
      throw new Error("Report photos must be uploaded by you.");
    await ctx.db.delete("reportUploads", pending._id);
  }
}

/** Every path that removes a report must also remove its private evidence. */
export async function deleteReport(ctx: MutationCtx, report: Doc<"spotReports">) {
  for (const storageId of report.photoIds ?? []) await ctx.storage.delete(storageId);
  await ctx.db.delete("spotReports", report._id);
}
