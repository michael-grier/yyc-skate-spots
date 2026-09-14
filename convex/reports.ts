import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUnblockedIdentity } from "./auth";
import { MAX_OPEN_REPORTS_PER_SPOT, spotModerationFor } from "./moderationModel";
import { claimReportPhotos } from "./reportPhotos";
import { MAX_REPORT_PHOTOS } from "./constants";
import { reportReason } from "./schema";

const MAX_DETAILS_LENGTH = 500;

/** Adds one private report and returns the spot to the admin review queue. */
export const create = mutation({
  args: {
    spotId: v.id("spots"),
    reason: reportReason,
    photoIds: v.optional(v.array(v.id("_storage"))),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUnblockedIdentity(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot || spot.deletionRequested) {
      throw new Error("Spot not found.");
    }
    if (spot.createdBy === identity.tokenIdentifier) {
      throw new Error("You cannot report your own spot.");
    }
    const photoIds = args.photoIds ?? [];
    if (photoIds.length > MAX_REPORT_PHOTOS || new Set(photoIds).size !== photoIds.length) {
      throw new Error(`Attach up to ${MAX_REPORT_PHOTOS} different report photos.`);
    }
    if (args.reason === "gone_or_unusable" && photoIds.length === 0) {
      throw new Error("Add at least one photo showing why the spot is no longer skateable.");
    }
    if (args.reason !== "gone_or_unusable" && photoIds.length > 0) {
      throw new Error("Photo evidence is only supported for dead-spot reports.");
    }
    const details = args.details?.trim();
    if (details && details.length > MAX_DETAILS_LENGTH) {
      throw new Error(`Report details must be at most ${MAX_DETAILS_LENGTH} characters.`);
    }
    const existing = await ctx.db
      .query("spotReports")
      .withIndex("by_spotId_and_reportedBy", (q) =>
        q.eq("spotId", args.spotId).eq("reportedBy", identity.tokenIdentifier),
      )
      .unique();
    if (existing) {
      throw new Error("You have already reported this spot.");
    }
    const reports = await ctx.db
      .query("spotReports")
      .withIndex("by_spotId", (q) => q.eq("spotId", args.spotId))
      .take(MAX_OPEN_REPORTS_PER_SPOT);
    if (reports.length >= MAX_OPEN_REPORTS_PER_SPOT) {
      throw new Error("This spot already has enough reports for review.");
    }

    await claimReportPhotos(ctx, identity.tokenIdentifier, photoIds);
    await ctx.db.insert("spotReports", {
      spotId: args.spotId,
      reportedBy: identity.tokenIdentifier,
      reason: args.reason,
      ...(photoIds.length ? { photoIds } : {}),
      ...(details ? { details } : {}),
    });
    const moderation = await spotModerationFor(ctx, args.spotId);
    if (moderation) {
      await ctx.db.patch("spotModeration", moderation._id, {
        needsReview: true,
        attentionReason: "reported",
        openReportCount: reports.length + 1,
        reviewedAt: undefined,
        reviewedBy: undefined,
      });
    } else {
      await ctx.db.insert("spotModeration", {
        spotId: spot._id,
        spotCreationTime: spot._creationTime,
        needsReview: true,
        attentionReason: "reported",
        lastSubmittedAt: spot._creationTime,
        openReportCount: reports.length + 1,
      });
    }
    return null;
  },
});
