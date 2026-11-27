import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import {
  requireAdmin,
  requireIdentity,
  standardsAcknowledgementFor,
  userModerationFor,
} from "./auth";
import {
  COMMUNITY_STANDARDS_VERSION,
  MAX_CHANGES_MESSAGE_LENGTH,
  MIN_CHANGES_MESSAGE_LENGTH,
  SEED_OWNER,
} from "./constants";
import {
  assertReviewVersion,
  clearSpotModeration,
  deleteOpenReports,
  MAX_OPEN_REPORTS_PER_SPOT,
  spotIsPublished,
  spotModerationFor,
  syncReviewState,
} from "./moderationModel";
import { insertNotice } from "./noticeModel";
import { contributorName, type profileFor } from "./profileModel";
import { clearSpotWork, spotWorkFor } from "./spotWorkModel";
import { reportReason } from "./schema";
import { MAX_SPOTS_LISTED, releasePhotos, scheduleSpotDeletion } from "./spots";

const MAX_REMOVAL_TEXT_LENGTH = 500;
const MAX_ELIGIBLE_CONTRIBUTORS = 100;

/** Admins see the public name. Unnamed seed fixtures have no account to derive one from. */
async function creatorLabel(
  ctx: QueryCtx,
  userIdentifier: string,
  legacyName: string | undefined,
  profiles?: Map<string, ReturnType<typeof profileFor>>,
) {
  return userIdentifier === SEED_OWNER && !legacyName?.trim()
    ? "Seeded content"
    : await contributorName(ctx, userIdentifier, legacyName, profiles);
}

function reviewState(spot: Doc<"spots">, moderation: Doc<"spotModeration"> | undefined) {
  return {
    needsReview: moderation?.needsReview ?? true,
    attentionReason: moderation?.attentionReason ?? ("new" as const),
    lastSubmittedAt: moderation?.lastSubmittedAt ?? spot._creationTime,
    openReportCount: moderation?.openReportCount ?? 0,
    reviewedAt: moderation?.reviewedAt,
    // Decisions send this back, so one made on a stale screen is refused.
    reviewVersion: moderation?.reviewVersion ?? 0,
  };
}

/** Identity and contribution status used to gate admin and add-spot UI. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        isAdmin: false,
        isBanned: false,
        confirmedRemovalCount: 0,
        hasAcknowledgedStandards: false,
      };
    }
    const [moderation, acknowledgement] = await Promise.all([
      userModerationFor(ctx, identity.tokenIdentifier),
      standardsAcknowledgementFor(ctx, identity.tokenIdentifier),
    ]);
    return {
      isAdmin: identity.role === "admin",
      isBanned: moderation?.isBanned ?? false,
      confirmedRemovalCount: moderation?.confirmedRemovalCount ?? 0,
      hasAcknowledgedStandards: acknowledgement?.standardsVersion === COMMUNITY_STANDARDS_VERSION,
    };
  },
});

/** Records the current policy version before the caller's first contribution. */
export const acknowledgeStandards = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await standardsAcknowledgementFor(ctx, identity.tokenIdentifier);
    if (existing?.standardsVersion === COMMUNITY_STANDARDS_VERSION) {
      return null;
    }
    const acceptedAt = Date.now();
    if (existing) {
      await ctx.db.patch("communityAcknowledgements", existing._id, {
        standardsVersion: COMMUNITY_STANDARDS_VERSION,
        acceptedAt,
      });
    } else {
      await ctx.db.insert("communityAcknowledgements", {
        userIdentifier: identity.tokenIdentifier,
        standardsVersion: COMMUNITY_STANDARDS_VERSION,
        acceptedAt,
      });
    }
    return null;
  },
});

/** The admin queue's spots: non-deleted and not private, newest first. */
async function queueSpots(ctx: QueryCtx) {
  return await ctx.db
    .query("spots")
    .order("desc")
    .filter((q) =>
      q.and(
        q.neq(q.field("deletionRequested"), true),
        q.neq(q.field("publicationStatus"), "private"),
      ),
    )
    .take(MAX_SPOTS_LISTED);
}

/** How many queued spots need an admin decision; the queue's Needs review filter matches it. */
export const reviewCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const spots = await queueSpots(ctx);
    const waiting = await Promise.all(
      spots.map(async (spot) => {
        const moderation = await spotModerationFor(ctx, spot._id);
        // Spots from before moderation rows existed count as unreviewed, as in the queue.
        if (moderation?.needsReview ?? true) return true;
        // A pending fix keeps its spot tagged, so untagged spots can't have one.
        if (!spot.needsWork) return false;
        const work = await spotWorkFor(ctx, spot._id);
        return work !== null && work.acceptedAt === undefined;
      }),
    );
    return waiting.filter(Boolean).length;
  },
});

/** All non-deleted spots, newest first, with private review metadata for the admin list. */
export const listSpots = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const activeSpots = await queueSpots(ctx);
    const creatorIdentifiers = [...new Set(activeSpots.map((spot) => spot.createdBy))];
    const profiles = new Map<string, ReturnType<typeof profileFor>>();
    // Indexed lookups keep metadata aligned with the selected spots even after
    // the moderation tables grow beyond the queue's display limit.
    const [moderationRows, contributorRows, workRows] = await Promise.all([
      Promise.all(activeSpots.map((spot) => spotModerationFor(ctx, spot._id))),
      Promise.all(creatorIdentifiers.map((identifier) => userModerationFor(ctx, identifier))),
      Promise.all(activeSpots.map((spot) => (spot.needsWork ? spotWorkFor(ctx, spot._id) : null))),
    ]);
    const pendingWorkSpots = new Set(
      workRows.flatMap((row) => (row && row.acceptedAt === undefined ? [row.spotId] : [])),
    );
    const moderationBySpot = new Map(
      moderationRows.filter((row) => row !== null).map((row) => [row.spotId, row]),
    );
    const contributorByIdentifier = new Map(
      contributorRows.filter((row) => row !== null).map((row) => [row.userIdentifier, row]),
    );
    return await Promise.all(
      activeSpots.map(
        // Admins need upload eligibility, not the owner's notification/read state.
        async ({
          photoIds,
          createdBy,
          deletionRequested: _deletionRequested,
          allowAdminPhotos,
          adminPhotosAddedAt: _adminPhotosAddedAt,
          adminPhotosUnseen: _adminPhotosUnseen,
          ...spot
        }) => {
          const contributor = contributorByIdentifier.get(createdBy);
          return {
            ...spot,
            creatorName: await creatorLabel(ctx, createdBy, spot.createdByName, profiles),
            creatorRemovalCount: contributor?.confirmedRemovalCount ?? 0,
            creatorIsBanned: contributor?.isBanned ?? false,
            creatorModerationId: contributor?._id ?? null,
            canAddAdminPhotos: allowAdminPhotos === true && photoIds.length === 0,
            workSubmitted: pendingWorkSpots.has(spot._id),
            previewPhotoUrl: photoIds.length > 0 ? await ctx.storage.getUrl(photoIds[0]) : null,
            review: reviewState({ ...spot, photoIds, createdBy }, moderationBySpot.get(spot._id)),
          };
        },
      ),
    );
  },
});

/** One non-deleted spot, its open reports, and creator status for admin review. */
export const getSpot = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const id = ctx.db.normalizeId("spots", args.id);
    const spot = id ? await ctx.db.get("spots", id) : null;
    // Private spots are the owner's alone, admins included.
    if (!spot || spot.deletionRequested || spot.publicationStatus === "private") {
      return null;
    }
    const [moderation, contributor, reports, work] = await Promise.all([
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
      spotWorkFor(ctx, spot._id),
    ]);
    const photoUrls = (
      await Promise.all(spot.photoIds.map((photoId) => ctx.storage.getUrl(photoId)))
    ).filter((url): url is string => url !== null);
    const fix = work && {
      _id: work._id,
      submitterName: await creatorLabel(ctx, work.submittedBy, undefined),
      photoUrls: (await Promise.all(work.photoIds.map((id) => ctx.storage.getUrl(id)))).filter(
        (url): url is string => url !== null,
      ),
    };
    // Owner notification metadata must also stay out of the admin detail response.
    const {
      photoIds: _photoIds,
      createdBy: _createdBy,
      deletionRequested: _deletionRequested,
      allowAdminPhotos: _allowAdminPhotos,
      adminPhotosAddedAt: _adminPhotosAddedAt,
      adminPhotosUnseen: _adminPhotosUnseen,
      ...fields
    } = spot;
    return {
      ...fields,
      photoUrls,
      canAddAdminPhotos: spot.allowAdminPhotos === true && spot.photoIds.length === 0,
      // Request changes is only for spots that aren't live; rollout-era rows resolve here.
      isLive: await spotIsPublished(ctx, spot),
      review: {
        ...reviewState(spot, moderation ?? undefined),
        requestedChanges: moderation?.requestedChanges ?? null,
        ownerNote: moderation?.ownerNote ?? null,
      },
      // A pending fix needs a decision; an approved one is public, so admins can still take it down.
      approvedFix:
        fix && work?.acceptedAt !== undefined ? { ...fix, acceptedAt: work.acceptedAt } : null,
      workSubmission:
        fix && work?.acceptedAt === undefined
          ? { ...fix, _creationTime: work._creationTime, details: work.details }
          : null,
      creator: {
        name: await creatorLabel(ctx, spot.createdBy, spot.createdByName),
        // Seed rows have no account, so removal adds no strike and sends no notice.
        isSeeded: spot.createdBy === SEED_OWNER,
        confirmedRemovalCount: contributor?.confirmedRemovalCount ?? 0,
        isBanned: contributor?.isBanned ?? false,
        moderationId: contributor?._id ?? null,
      },
      reports: await Promise.all(
        reports.map(async ({ _id, _creationTime, reason, details, photoIds }) => ({
          _id,
          _creationTime,
          reason,
          details,
          photoUrls: (
            await Promise.all((photoIds ?? []).map((id) => ctx.storage.getUrl(id)))
          ).filter((url): url is string => url !== null),
        })),
      ),
    };
  },
});

/** Clears open reports and records that the current version passed review. */
export const markMeetsStandards = mutation({
  args: { spotId: v.id("spots"), expectedReviewVersion: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    // A spot made private after an admin opened it is theirs alone again.
    if (!spot || spot.deletionRequested || spot.publicationStatus === "private") {
      throw new Error("Spot not found.");
    }
    assertReviewVersion(await spotModerationFor(ctx, spot._id), args.expectedReviewVersion);
    if (spot.publicationStatus === "needs_changes") {
      throw new Error(
        "This spot is waiting on its contributor. Review it again once they resubmit.",
      );
    }
    const wasPublished = await spotIsPublished(ctx, spot);
    await ctx.db.patch("spots", spot._id, { publicationStatus: "published" });
    const reports = await deleteOpenReports(ctx, args.spotId);
    // An admin deciding on their own spot or report needs no update about it.
    if (!wasPublished && spot.createdBy !== identity.tokenIdentifier) {
      await insertNotice(ctx, {
        recipient: spot.createdBy,
        kind: "spot_published",
        spotId: spot._id,
        spotName: spot.name,
      });
    }
    for (const report of reports) {
      if (report.reportedBy !== identity.tokenIdentifier) {
        await insertNotice(ctx, {
          recipient: report.reportedBy,
          kind: "report_kept",
          spotId: spot._id,
          spotName: report.spotName ?? spot.name,
          reason: report.reason,
        });
      }
    }
    // A published spot's request is settled, so the next review starts clean.
    await syncReviewState(ctx, spot._id, {
      reviewedAt: Date.now(),
      reviewedBy: identity.tokenIdentifier,
      requestedChanges: undefined,
      ownerNote: undefined,
    });
    return null;
  },
});

/**
 * Sends a spot waiting for review back to its owner with a message, instead of removing it.
 * It stays off the map and adds no strike. Reports on it wait for the resubmission.
 */
export const requestChanges = mutation({
  args: {
    spotId: v.id("spots"),
    expectedReviewVersion: v.optional(v.number()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot || spot.deletionRequested || spot.publicationStatus === "private") {
      throw new Error("Spot not found.");
    }
    assertReviewVersion(await spotModerationFor(ctx, spot._id), args.expectedReviewVersion);
    // A live spot is never taken down this way; that is what removal is for.
    if (spot.publicationStatus === "needs_changes" || (await spotIsPublished(ctx, spot))) {
      throw new Error("Only a spot waiting for review can be sent back for changes.");
    }
    const message = args.message.trim();
    if (
      message.length < MIN_CHANGES_MESSAGE_LENGTH ||
      message.length > MAX_CHANGES_MESSAGE_LENGTH
    ) {
      throw new Error(
        `Tell the contributor what to change in ${MIN_CHANGES_MESSAGE_LENGTH}–${MAX_CHANGES_MESSAGE_LENGTH} characters.`,
      );
    }
    const at = Date.now();
    await ctx.db.patch("spots", spot._id, { publicationStatus: "needs_changes" });
    await syncReviewState(ctx, spot._id, {
      requestedChanges: { message, at },
      ownerNote: undefined,
      reviewedAt: at,
      reviewedBy: identity.tokenIdentifier,
    });
    if (spot.createdBy !== identity.tokenIdentifier) {
      await insertNotice(ctx, {
        recipient: spot.createdBy,
        kind: "spot_changes_requested",
        spotId: spot._id,
        spotName: spot.name,
        message,
      });
    }
    return null;
  },
});

/** Dead spots are map maintenance; only other removal reasons add a contributor strike. */
export const removeSpot = mutation({
  args: {
    spotId: v.id("spots"),
    reason: reportReason,
    details: v.optional(v.string()),
    ownerMessage: v.optional(v.string()),
    expectedReviewVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    // A spot made private after an admin opened it is theirs alone again.
    if (!spot || spot.deletionRequested || spot.publicationStatus === "private") {
      throw new Error("Spot not found.");
    }
    assertReviewVersion(await spotModerationFor(ctx, spot._id), args.expectedReviewVersion);
    const details = args.details?.trim();
    if (details && details.length > MAX_REMOVAL_TEXT_LENGTH) {
      throw new Error(`Removal details must be at most ${MAX_REMOVAL_TEXT_LENGTH} characters.`);
    }
    const ownerMessage = args.ownerMessage?.trim();
    if (ownerMessage && ownerMessage.length > MAX_REMOVAL_TEXT_LENGTH) {
      throw new Error(
        `The message to the contributor must be at most ${MAX_REMOVAL_TEXT_LENGTH} characters.`,
      );
    }
    // Read before the moderation row goes, since rollout-era spots resolve through it.
    const wasLive = await spotIsPublished(ctx, spot);
    const reports = await clearSpotModeration(ctx, spot._id);
    await clearSpotWork(ctx, spot._id);
    await releasePhotos(ctx, spot.photoIds);
    await scheduleSpotDeletion(ctx, spot._id);

    let strikeNumber = 0;
    let contributorModerationId = null;
    if (spot.createdBy !== SEED_OWNER && args.reason !== "gone_or_unusable") {
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
      ...(ownerMessage ? { ownerMessage } : {}),
      removedAt,
      removedBy: identity.tokenIdentifier,
      reportCount: reports.length,
      strikeNumber,
    });
    if (spot.createdBy !== identity.tokenIdentifier) {
      // The spot id still opens the owner's removal notice after the spot is gone.
      await insertNotice(ctx, {
        recipient: spot.createdBy,
        kind: "spot_removed",
        spotId: spot._id,
        spotName: spot.name,
        reason: args.reason,
        ...(ownerMessage ? { message: ownerMessage } : {}),
      });
    }
    for (const report of reports) {
      if (report.reportedBy !== identity.tokenIdentifier) {
        await insertNotice(ctx, {
          recipient: report.reportedBy,
          kind: "report_removed",
          // Reports from before the snapshot fall back to a label, not an unapproved rename.
          spotName: report.spotName ?? (wasLive ? spot.name : "A spot you reported"),
          reason: report.reason,
        });
      }
    }
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
    return Promise.all(
      contributors.map(async ({ _id, userIdentifier, name, confirmedRemovalCount }) => ({
        _id,
        name: await contributorName(ctx, userIdentifier, name),
        confirmedRemovalCount,
      })),
    );
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
