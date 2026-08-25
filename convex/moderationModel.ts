import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const MAX_OPEN_REPORTS_PER_SPOT = 20;

export async function spotModerationFor(ctx: MutationCtx, spotId: Id<"spots">) {
  return await ctx.db
    .query("spotModeration")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .unique();
}

/** Adds a new spot to the proactive queue in the same transaction as publish. */
export async function queueNewSpot(ctx: MutationCtx, spot: Doc<"spots">) {
  await ctx.db.insert("spotModeration", {
    spotId: spot._id,
    spotCreationTime: spot._creationTime,
    needsReview: true,
    attentionReason: "new",
    lastSubmittedAt: spot._creationTime,
    openReportCount: 0,
  });
}

/** Returns an edited spot to the queue without losing any open report count. */
export async function queueEditedSpot(ctx: MutationCtx, spot: Doc<"spots">) {
  const moderation = await spotModerationFor(ctx, spot._id);
  if (moderation) {
    await ctx.db.patch("spotModeration", moderation._id, {
      needsReview: true,
      attentionReason: moderation.openReportCount > 0 ? "reported" : "edited",
      lastSubmittedAt: Date.now(),
      reviewedAt: undefined,
      reviewedBy: undefined,
    });
    return;
  }
  await ctx.db.insert("spotModeration", {
    spotId: spot._id,
    spotCreationTime: spot._creationTime,
    needsReview: true,
    attentionReason: "edited",
    lastSubmittedAt: Date.now(),
    openReportCount: 0,
  });
}

/** Deletes every open report, whose count is capped at submission time. */
export async function deleteOpenReports(ctx: MutationCtx, spotId: Id<"spots">) {
  const reports = await ctx.db
    .query("spotReports")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .take(MAX_OPEN_REPORTS_PER_SPOT);
  for (const report of reports) {
    await ctx.db.delete("spotReports", report._id);
  }
  return reports.length;
}

/** Deletes reports and operational state for a departing spot. */
export async function clearSpotModeration(ctx: MutationCtx, spotId: Id<"spots">) {
  const reportCount = await deleteOpenReports(ctx, spotId);
  const moderation = await spotModerationFor(ctx, spotId);
  if (moderation) {
    await ctx.db.delete("spotModeration", moderation._id);
  }
  return reportCount;
}
