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

type PublicationStatus = NonNullable<Doc<"spots">["publicationStatus"]>;
type SubmissionReason = NonNullable<Doc<"spotModeration">["submissionReason"]>;
type ReviewFields = Partial<
  Pick<
    Doc<"spotModeration">,
    | "submissionReason"
    | "lastSubmittedAt"
    | "reviewedAt"
    | "reviewedBy"
    | "requestedChanges"
    | "ownerNote"
  >
>;

/**
 * What the admin queue shows for a spot. Reports on a spot sent back for changes wait for the
 * resubmission, so the admin still sees them then and reporters hear only the final outcome.
 */
export function reviewAttention(
  status: PublicationStatus,
  openReportCount: number,
  submissionReason: SubmissionReason,
) {
  const reportsWaiting = openReportCount > 0 && status !== "needs_changes";
  return {
    needsReview: status === "pending" || reportsWaiting,
    attentionReason: reportsWaiting ? ("reported" as const) : submissionReason,
  };
}

/**
 * Rows from before submissionReason kept only attentionReason, which a report overwrote. For
 * those, a submission that never moved past creation was new; any later one was an edit.
 */
export function legacySubmissionReason(
  moderation: Pick<
    Doc<"spotModeration">,
    "submissionReason" | "attentionReason" | "lastSubmittedAt" | "spotCreationTime"
  >,
): SubmissionReason {
  if (moderation.submissionReason) return moderation.submissionReason;
  if (moderation.attentionReason !== "reported") return moderation.attentionReason;
  return moderation.lastSubmittedAt === moderation.spotCreationTime ? "new" : "edited";
}

/**
 * Time-based, so a row recreated after the spot was private can't repeat a version that a
 * screen from before then still holds.
 */
export function nextReviewVersion(previous: number | undefined) {
  return Math.max(Date.now(), (previous ?? 0) + 1);
}

/**
 * Invalidates open decision screens without touching queue state, for changes a reviewer must
 * see but that aren't a new submission.
 */
export async function bumpReviewVersion(ctx: MutationCtx, spotId: Id<"spots">) {
  const moderation = await spotModerationFor(ctx, spotId);
  if (moderation) {
    await ctx.db.patch("spotModeration", moderation._id, {
      reviewVersion: nextReviewVersion(moderation.reviewVersion),
    });
  } else {
    // Decisions read a missing row as version 0, so it needs a row to carry a newer one.
    await syncReviewState(ctx, spotId);
  }
}

/** Refuses a decision made on a screen showing an older review state. */
export function assertReviewVersion(
  moderation: Doc<"spotModeration"> | null,
  expected: number | undefined,
) {
  // Optional for one release, until every admin build sends it.
  if (expected !== undefined && (moderation?.reviewVersion ?? 0) !== expected) {
    throw new Error("This spot changed while you were reviewing it. Check it again, then decide.");
  }
}

/**
 * The only writer of needsReview and attentionReason. Derives both from the spot's status and
 * open reports, applies `fields`, and bumps the review version. Call after any change to a
 * non-private spot's status, reports, or submission.
 */
export async function syncReviewState(
  ctx: MutationCtx,
  spotId: Id<"spots">,
  fields: ReviewFields = {},
) {
  const spot = await ctx.db.get("spots", spotId);
  if (!spot) {
    throw new Error("Spot not found.");
  }
  const moderation = await spotModerationFor(ctx, spotId);
  // A rollout-era spot with no row was never reviewed. The queue has always listed it as new,
  // so its first row keeps it there until an admin decides, even though it stays live.
  const neverReviewed = spot.publicationStatus === undefined && moderation === null;
  let status = spot.publicationStatus;
  if (status === undefined) {
    // A rollout-era spot reads its status through this row, which the sync is about to change.
    status = (await spotIsPublished(ctx, spot)) ? "published" : "pending";
    await ctx.db.patch("spots", spot._id, { publicationStatus: status });
  }
  const openReportCount = (
    await ctx.db
      .query("spotReports")
      .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
      .take(MAX_OPEN_REPORTS_PER_SPOT)
  ).length;
  const submissionReason =
    fields.submissionReason ?? (moderation ? legacySubmissionReason(moderation) : "new");
  const attention = reviewAttention(status, openReportCount, submissionReason);
  const state = {
    ...fields,
    ...attention,
    needsReview: attention.needsReview || neverReviewed,
    submissionReason,
    openReportCount,
    reviewVersion: nextReviewVersion(moderation?.reviewVersion),
  };
  if (moderation) {
    await ctx.db.patch("spotModeration", moderation._id, state);
  } else {
    await ctx.db.insert("spotModeration", {
      spotId,
      spotCreationTime: spot._creationTime,
      lastSubmittedAt: spot._creationTime,
      ...state,
    });
  }
}

/**
 * Records review state atomically with creation, including admin self-approval.
 * `submittedAt` is later than creation when a private spot is first made public.
 */
export async function recordNewSpotModeration(
  ctx: MutationCtx,
  spot: Doc<"spots">,
  submittedAt = spot._creationTime,
) {
  const published = spot.publicationStatus === "published";
  await syncReviewState(ctx, spot._id, {
    submissionReason: "new",
    lastSubmittedAt: submittedAt,
    ...(published ? { reviewedAt: submittedAt, reviewedBy: spot.createdBy } : {}),
  });
}

/**
 * Returns an edited spot to the queue. A spot sent back for changes comes back as resubmitted,
 * with the owner's note. An admin's edit to their own spot counts as reviewed by them, as their
 * new spots do, unless reports still await a decision.
 */
export async function queueEditedSpot(
  ctx: MutationCtx,
  spot: Doc<"spots">,
  {
    adminEditor,
    resubmitted,
    ownerNote,
  }: {
    adminEditor?: string;
    resubmitted: boolean;
    ownerNote?: string;
  },
) {
  const moderation = await spotModerationFor(ctx, spot._id);
  const now = Date.now();
  const selfReviewed = adminEditor !== undefined && (moderation?.openReportCount ?? 0) === 0;
  // Editing a resubmission again before review keeps it one; publishing clears the request.
  const stillResubmitted = resubmitted || moderation?.requestedChanges !== undefined;
  await syncReviewState(ctx, spot._id, {
    submissionReason: stillResubmitted ? "resubmitted" : "edited",
    lastSubmittedAt: now,
    reviewedAt: selfReviewed ? now : undefined,
    reviewedBy: selfReviewed ? adminEditor : undefined,
    ...(resubmitted ? { ownerNote } : {}),
  });
}

/**
 * Deletes every open report, whose count is capped at submission time, and
 * returns them so a review decision can tell each reporter the outcome.
 */
export async function deleteOpenReports(ctx: MutationCtx, spotId: Id<"spots">) {
  const reports = await ctx.db
    .query("spotReports")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .take(MAX_OPEN_REPORTS_PER_SPOT);
  for (const report of reports) {
    await deleteReport(ctx, report);
  }
  return reports;
}

/** Deletes reports and operational state for a departing spot, returning the reports. */
export async function clearSpotModeration(ctx: MutationCtx, spotId: Id<"spots">) {
  const reports = await deleteOpenReports(ctx, spotId);
  const moderation = await spotModerationFor(ctx, spotId);
  if (moderation) {
    await ctx.db.delete("spotModeration", moderation._id);
  }
  return reports;
}
