import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireIdentity } from "./auth";
import { MAX_OPEN_REPORTS_PER_SPOT, spotModerationFor } from "./moderationModel";
import { reportReason } from "./schema";

const MAX_DETAILS_LENGTH = 500;

/** Adds one private report and returns the spot to the admin review queue. */
export const create = mutation({
  args: {
    spotId: v.id("spots"),
    reason: reportReason,
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot) {
      throw new Error("Spot not found.");
    }
    if (spot.createdBy === identity.tokenIdentifier) {
      throw new Error("You cannot report your own spot.");
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

    await ctx.db.insert("spotReports", {
      spotId: args.spotId,
      reportedBy: identity.tokenIdentifier,
      reason: args.reason,
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
