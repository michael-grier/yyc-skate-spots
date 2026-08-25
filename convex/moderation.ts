import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin, userModerationFor } from "./auth";
import { SEED_OWNER } from "./constants";
import {
  clearSpotModeration,
  deleteOpenReports,
  MAX_OPEN_REPORTS_PER_SPOT,
  spotModerationFor,
} from "./moderationModel";
import { reportReason } from "./schema";
import { MAX_SPOTS_LISTED, releasePhotos } from "./spots";

const MAX_REMOVAL_DETAILS_LENGTH = 500;
const MAX_ELIGIBLE_CONTRIBUTORS = 100;

function reviewState(spot: Doc<"spots">, moderation: Doc<"spotModeration"> | undefined) {
  return {
    needsReview: moderation?.needsReview ?? true,
    attentionReason: moderation?.attentionReason ?? ("new" as const),
    lastSubmittedAt: moderation?.lastSubmittedAt ?? spot._creationTime,
    openReportCount: moderation?.openReportCount ?? 0,
    reviewedAt: moderation?.reviewedAt,
  };
}

/** Identity and contribution status used to gate admin and add-spot UI. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isAdmin: false, isBanned: false, confirmedRemovalCount: 0 };
    }
    const moderation = await userModerationFor(ctx, identity.tokenIdentifier);
    return {
      isAdmin: identity.role === "admin",
      isBanned: moderation?.isBanned ?? false,
      confirmedRemovalCount: moderation?.confirmedRemovalCount ?? 0,
    };
  },
});

/** All live spots, newest first, with private review metadata for the admin list. */
export const listSpots = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [spots, moderationRows, contributorRows] = await Promise.all([
      ctx.db.query("spots").order("desc").take(MAX_SPOTS_LISTED),
      ctx.db.query("spotModeration").take(MAX_SPOTS_LISTED),
      ctx.db.query("userModeration").take(MAX_SPOTS_LISTED),
    ]);
    const moderationBySpot = new Map(moderationRows.map((row) => [row.spotId, row]));
    const contributorByIdentifier = new Map(
      contributorRows.map((row) => [row.userIdentifier, row]),
    );
    return await Promise.all(
      spots.map(async ({ photoIds, createdBy, ...spot }) => {
        const contributor = contributorByIdentifier.get(createdBy);
        return {
          ...spot,
          creatorName: spot.createdByName,
          creatorRemovalCount: contributor?.confirmedRemovalCount ?? 0,
          creatorIsBanned: contributor?.isBanned ?? false,
          creatorModerationId: contributor?._id ?? null,
          previewPhotoUrl: photoIds.length > 0 ? await ctx.storage.getUrl(photoIds[0]) : null,
          review: reviewState({ ...spot, photoIds, createdBy }, moderationBySpot.get(spot._id)),
        };
      }),
    );
  },
});

/** One live spot, its open reports, and creator status for admin review. */
export const getSpot = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const id = ctx.db.normalizeId("spots", args.id);
    const spot = id ? await ctx.db.get("spots", id) : null;
    if (!spot) {
      return null;
    }
    const [moderation, contributor, reports] = await Promise.all([
      ctx.db
        .query("spotModeration")
        .withIndex("by_spotId", (q) => q.eq("spotId", spot._id))
        .unique(),
      userModerationFor(ctx, spot.createdBy),
      ctx.db
        .query("spotReports")
        .withIndex("by_spotId", (q) => q.eq("spotId", spot._id))
        .order("desc")
        .take(MAX_OPEN_REPORTS_PER_SPOT),
    ]);
    const photoUrls = (
      await Promise.all(spot.photoIds.map((photoId) => ctx.storage.getUrl(photoId)))
    ).filter((url): url is string => url !== null);
    const { photoIds: _photoIds, createdBy: _createdBy, ...fields } = spot;
    return {
      ...fields,
      photoUrls,
      review: reviewState(spot, moderation ?? undefined),
      creator: {
        name: spot.createdByName,
        confirmedRemovalCount: contributor?.confirmedRemovalCount ?? 0,
        isBanned: contributor?.isBanned ?? false,
        moderationId: contributor?._id ?? null,
      },
      reports: reports.map(({ _id, _creationTime, reason, details }) => ({
        _id,
        _creationTime,
        reason,
        details,
      })),
    };
  },
});

/** Clears open reports and records that the current version passed review. */
export const markMeetsStandards = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot) {
      throw new Error("Spot not found.");
    }
    await deleteOpenReports(ctx, args.spotId);
    const moderation = await spotModerationFor(ctx, args.spotId);
    const reviewedAt = Date.now();
    if (moderation) {
      await ctx.db.patch("spotModeration", moderation._id, {
        needsReview: false,
        openReportCount: 0,
        reviewedAt,
        reviewedBy: identity.tokenIdentifier,
      });
    } else {
      await ctx.db.insert("spotModeration", {
        spotId: spot._id,
        spotCreationTime: spot._creationTime,
        needsReview: false,
        attentionReason: "new",
        lastSubmittedAt: spot._creationTime,
        openReportCount: 0,
        reviewedAt,
        reviewedBy: identity.tokenIdentifier,
      });
    }
    return null;
  },
});

/** Removes a live spot and records one confirmed standards violation. */
export const removeSpot = mutation({
  args: {
    spotId: v.id("spots"),
    reason: reportReason,
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot) {
      throw new Error("Spot not found.");
    }
    const details = args.details?.trim();
    if (details && details.length > MAX_REMOVAL_DETAILS_LENGTH) {
      throw new Error(`Removal details must be at most ${MAX_REMOVAL_DETAILS_LENGTH} characters.`);
    }
    const reportCount = await clearSpotModeration(ctx, spot._id);
    await releasePhotos(ctx, spot.photoIds);
    await ctx.db.delete("spots", spot._id);

    let strikeNumber = 0;
    let contributorModerationId = null;
    if (spot.createdBy !== SEED_OWNER) {
      const existing = await userModerationFor(ctx, spot.createdBy);
      strikeNumber = (existing?.confirmedRemovalCount ?? 0) + 1;
      if (existing) {
        await ctx.db.patch("userModeration", existing._id, {
          confirmedRemovalCount: strikeNumber,
          name: spot.createdByName ?? existing.name,
        });
        contributorModerationId = existing._id;
      } else {
        contributorModerationId = await ctx.db.insert("userModeration", {
          userIdentifier: spot.createdBy,
          name: spot.createdByName,
          confirmedRemovalCount: strikeNumber,
          isBanned: false,
        });
      }
    }

    const removedAt = Date.now();
    await ctx.db.insert("spotRemovals", {
      spotId: spot._id,
      spotCreationTime: spot._creationTime,
      name: spot.name,
      createdBy: spot.createdBy,
      createdByName: spot.createdByName,
      reason: args.reason,
      ...(details ? { details } : {}),
      removedAt,
      removedBy: identity.tokenIdentifier,
      reportCount,
      strikeNumber,
    });
    return {
      strikeCount: strikeNumber,
      eligibleForBan: strikeNumber >= 3,
      contributorModerationId,
    };
  },
});

/** Contributors who reached three removals and have not been banned. */
export const listEligibleContributors = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const contributors = await ctx.db
      .query("userModeration")
      .withIndex("by_isBanned_and_confirmedRemovalCount", (q) =>
        q.eq("isBanned", false).gte("confirmedRemovalCount", 3),
      )
      .order("desc")
      .take(MAX_ELIGIBLE_CONTRIBUTORS);
    return contributors.map(({ _id, name, confirmedRemovalCount }) => ({
      _id,
      name,
      confirmedRemovalCount,
    }));
  },
});

/** Applies a manual contribution ban after the confirmed-removal threshold. */
export const banContributor = mutation({
  args: { moderationUserId: v.id("userModeration") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const contributor = await ctx.db.get("userModeration", args.moderationUserId);
    if (!contributor) {
      throw new Error("Contributor not found.");
    }
    if (contributor.confirmedRemovalCount < 3) {
      throw new Error("Three confirmed removals are required before a ban.");
    }
    if (!contributor.isBanned) {
      await ctx.db.patch("userModeration", contributor._id, {
        isBanned: true,
        bannedAt: Date.now(),
        bannedBy: identity.tokenIdentifier,
      });
    }
    return null;
  },
});

/** Reverses a contribution ban without changing the confirmed-removal count. */
export const unbanContributor = mutation({
  args: { moderationUserId: v.id("userModeration") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const contributor = await ctx.db.get("userModeration", args.moderationUserId);
    if (!contributor) {
      throw new Error("Contributor not found.");
    }
    await ctx.db.patch("userModeration", contributor._id, {
      isBanned: false,
      bannedAt: undefined,
      bannedBy: undefined,
    });
    return null;
  },
});
