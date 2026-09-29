import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { deleteReport } from "./reportPhotos";

export const MAX_OPEN_REPORTS_PER_SPOT = 20;

export async function spotModerationFor(ctx: QueryCtx | MutationCtx, spotId: Id<"spots">) {
  return await ctx.db
    .query("spotModeration")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .unique();
}

/** Resolves rollout-era rows through their existing moderation state. */
export async function spotIsPublished(ctx: QueryCtx | MutationCtx, spot: Doc<"spots">) {
  if (spot.publicationStatus) {
    return spot.publicationStatus === "published";
  }
  const moderation = await spotModerationFor(ctx, spot._id);
  return moderation?.needsReview !== true;
}

/** Records review state atomically with creation, including admin self-approval. */
export async function recordNewSpotModeration(ctx: MutationCtx, spot: Doc<"spots">) {
  const published = spot.publicationStatus === "published";
  await ctx.db.insert("spotModeration", {
    spotId: spot._id,
    spotCreationTime: spot._creationTime,
    needsReview: !published,
    attentionReason: "new",
    lastSubmittedAt: spot._creationTime,
    openReportCount: 0,
    ...(published ? { reviewedAt: spot._creationTime, reviewedBy: spot.createdBy } : {}),
  });
}

/**
 * Returns an edited spot to the queue without losing any open report count. An admin's edit to
 * their own spot counts as reviewed by them, as their new spots do, unless reports still await a
 * decision.
 */
export async function queueEditedSpot(ctx: MutationCtx, spot: Doc<"spots">, adminEditor?: string) {
  const moderation = await spotModerationFor(ctx, spot._id);
  const now = Date.now();
  const openReportCount = moderation?.openReportCount ?? 0;
  const selfReviewed = adminEditor !== undefined && openReportCount === 0;
  const review = {
    needsReview: !selfReviewed,
    attentionReason: openReportCount > 0 ? ("reported" as const) : ("edited" as const),
    lastSubmittedAt: now,
    reviewedAt: selfReviewed ? now : undefined,
    reviewedBy: selfReviewed ? adminEditor : undefined,
  };
  if (moderation) {
    await ctx.db.patch("spotModeration", moderation._id, review);
    return;
  }
  await ctx.db.insert("spotModeration", {
    spotId: spot._id,
    spotCreationTime: spot._creationTime,
    openReportCount: 0,
    ...review,
  });
}

/** Deletes every open report, whose count is capped at submission time. */
export async function deleteOpenReports(ctx: MutationCtx, spotId: Id<"spots">) {
  const reports = await ctx.db
    .query("spotReports")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .take(MAX_OPEN_REPORTS_PER_SPOT);
  for (const report of reports) {
    await deleteReport(ctx, report);
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
