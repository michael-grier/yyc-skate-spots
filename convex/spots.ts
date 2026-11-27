import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin, requireCanContribute, requireIdentity } from "./auth";
import { MAX_OWNER_NOTE_LENGTH } from "./constants";
import {
  bumpReviewVersion,
  clearSpotModeration,
  queueEditedSpot,
  recordNewSpotModeration,
  spotIsPublished,
  spotModerationFor,
} from "./moderationModel";
import { PRIVATE_SPOTS_PER_PUBLISHED, privateSpotAllowance } from "./privateSpots";
import { describesWork } from "./needsWork";
import { contributorName, type profileFor } from "./profileModel";
import { clearSpotWork, spotWorkFor } from "./spotWorkModel";
import { bustFactor, spotType, surface } from "./schema";

// Caps chosen so a spot document stays far under Convex's 1MB limit and
// the add-spot form has concrete limits to enforce.
const MAX_PHOTOS = 6;
const MAX_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 2000;
// City-scale app: one bounded read covers Calgary's realistic spot count.
// Revisit with pagination + geo indexing if the table ever approaches this.
export const MAX_SPOTS_LISTED = 500;
const FAVORITE_DELETE_BATCH_SIZE = 100;

// Everything a submitter provides; ownership fields are always derived
// server-side from the authenticated identity, never accepted as args.
const spotFields = v.object({
  name: v.string(),
  types: v.array(spotType),
  bustFactor,
  surface: v.optional(surface),
  notes: v.optional(v.string()),
  latitude: v.number(),
  longitude: v.number(),
  photoIds: v.array(v.id("_storage")),
  allowAdminPhotos: v.optional(v.boolean()),
  // Optional so clients from before private spots keep submitting public ones.
  visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
});

/** Loads a spot and verifies the caller owns it; throws otherwise. */
async function requireOwnedSpot(ctx: MutationCtx, id: Id<"spots">, contributionRequired = false) {
  const identity = contributionRequired
    ? await requireCanContribute(ctx)
    : await requireIdentity(ctx);
  const spot = await ctx.db.get("spots", id);
  if (!spot || spot.deletionRequested) {
    throw new Error("Spot not found.");
  }
  if (spot.createdBy !== identity.tokenIdentifier) {
    throw new Error("Only the person who added a spot can change it.");
  }
  return { spot, identity };
}

const PRIVATE_NEEDS_WORK_ERROR =
  "Only you can see a private spot, so it can't be tagged as needing work.";
const NEEDS_WORK_DETAILS_ERROR =
  "Describe what needs doing in the notes, or add photos, before tagging a spot as needing work.";

/**
 * Refuses one more private spot beyond the caller's allowance. `excludeId` is
 * the spot being flipped, so its current state counts on neither side.
 */
async function assertPrivateAllowance(
  ctx: MutationCtx,
  owner: string,
  excludeId: Id<"spots"> | null,
) {
  const spots = await ctx.db
    .query("spots")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", owner))
    .take(MAX_SPOTS_LISTED);
  let privateCount = 0;
  let publishedCount = 0;
  for (const spot of spots) {
    if (spot.deletionRequested || spot._id === excludeId) {
      continue;
    }
    if (spot.publicationStatus === "private") {
      privateCount += 1;
    } else if (await spotIsPublished(ctx, spot)) {
      publishedCount += 1;
    }
  }
  const allowance = privateSpotAllowance(publishedCount);
  if (privateCount >= allowance) {
    throw new Error(
      `You've used all ${allowance} of your private spots. Each spot you publish adds ${PRIVATE_SPOTS_PER_PUBLISHED} more.`,
    );
  }
}

function validateSpotFields(fields: {
  name: string;
  types: string[];
  notes?: string;
  photoIds: unknown[];
  latitude: number;
  longitude: number;
}) {
  if (fields.name.trim().length === 0 || fields.name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be 1–${MAX_NAME_LENGTH} characters.`);
  }
  if (fields.types.length === 0 || new Set(fields.types).size !== fields.types.length) {
    throw new Error("Pick at least one spot type, each at most once.");
  }
  if (fields.notes !== undefined && fields.notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be at most ${MAX_NOTES_LENGTH} characters.`);
  }
  if (fields.photoIds.length > MAX_PHOTOS) {
    throw new Error(`A spot can have at most ${MAX_PHOTOS} photos.`);
  }
  if (new Set(fields.photoIds).size !== fields.photoIds.length) {
    throw new Error("The same photo cannot be attached twice.");
  }
  if (!Number.isFinite(fields.latitude) || Math.abs(fields.latitude) > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(fields.longitude) || Math.abs(fields.longitude) > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }
}

async function photoRef(ctx: MutationCtx, photoId: Id<"_storage">) {
  return await ctx.db
    .query("spotPhotos")
    .withIndex("by_storageId", (q) => q.eq("storageId", photoId))
    .unique();
}

/**
 * Rejects any photo already attached to a spot other than `spotId`. Storage
 * IDs become reachable once a spot is published, so without this a user
 * could attach someone else's photo to their own spot and later destroy the
 * file via update/remove.
 */
async function assertPhotosUnclaimed(
  ctx: MutationCtx,
  photoIds: Id<"_storage">[],
  spotId: Id<"spots"> | null,
) {
  for (const photoId of photoIds) {
    const ref = await photoRef(ctx, photoId);
    if (ref && ref.spotId !== spotId) {
      throw new Error("One of those photos already belongs to another spot.");
    }
  }
}

async function uploadRef(ctx: MutationCtx, storageId: Id<"_storage">) {
  return await ctx.db
    .query("uploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
}

/**
 * Consumes the caller's upload records for `photoIds`, rejecting any photo
 * the caller did not upload themselves. Together with assertPhotosUnclaimed
 * this means a storage id can only ever be attached by its uploader.
 */
export async function consumeUploads(
  ctx: MutationCtx,
  uploader: string,
  photoIds: Id<"_storage">[],
) {
  for (const photoId of photoIds) {
    const upload = await uploadRef(ctx, photoId);
    if (!upload || upload.uploadedBy !== uploader) {
      throw new Error("Photos must be uploaded by you before they can be attached.");
    }
    await ctx.db.delete("uploads", upload._id);
  }
}

async function claimPhotos(ctx: MutationCtx, photoIds: Id<"_storage">[], spotId: Id<"spots">) {
  for (const photoId of photoIds) {
    await ctx.db.insert("spotPhotos", { storageId: photoId, spotId });
  }
}

/**
 * Drops the references and deletes the files. Safe to delete outright:
 * claims are unique, so a released photo cannot belong to another spot.
 */
export async function releasePhotos(ctx: MutationCtx, photoIds: Id<"_storage">[]) {
  for (const photoId of photoIds) {
    const ref = await photoRef(ctx, photoId);
    if (ref) {
      await ctx.db.delete("spotPhotos", ref._id);
    }
    await ctx.storage.delete(photoId);
  }
}

/** Hides a departing spot and queues its potentially unbounded favorites cleanup. */
export async function scheduleSpotDeletion(ctx: MutationCtx, spotId: Id<"spots">) {
  await ctx.db.patch("spots", spotId, { deletionRequested: true, photoIds: [] });
  await ctx.scheduler.runAfter(0, internal.spots.removeFavoriteBatch, { spotId });
}

/** The first owner photo, or for a spot with none, the first photo of its approved fix. */
async function previewPhotoUrl(ctx: QueryCtx, spot: Doc<"spots">) {
  if (spot.photoIds.length > 0) return await ctx.storage.getUrl(spot.photoIds[0]);
  // Skipping unfixed spots keeps the map from re-running on every pending fix.
  if (spot.workCompletedAt === undefined) return null;
  const work = await spotWorkFor(ctx, spot._id);
  return work?.acceptedAt !== undefined && work.photoIds.length > 0
    ? await ctx.storage.getUrl(work.photoIds[0])
    : null;
}

/**
 * Published spots, plus the caller's private ones, with a first-photo URL for
 * the map's preview card. Raw photoIds and the owner's identity key never
 * leave the server — exposing storage IDs is what would let another user
 * attach (and later destroy) someone else's photos.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // isMine lets the map style the caller's own pins; the query is
    // identity-aware, so it re-runs on sign-in and sign-out.
    const identity = await ctx.auth.getUserIdentity();
    const visibleSpots: Doc<"spots">[] = [];
    const profiles = new Map<string, ReturnType<typeof profileFor>>();
    // Iteration lets hidden rows be skipped before the result cap.
    for await (const spot of ctx.db.query("spots").order("desc")) {
      if (spot.deletionRequested) {
        continue;
      }
      const visible =
        spot.publicationStatus === "private"
          ? identity !== null && spot.createdBy === identity.tokenIdentifier
          : await spotIsPublished(ctx, spot);
      if (!visible) {
        continue;
      }
      visibleSpots.push(spot);
      if (visibleSpots.length === MAX_SPOTS_LISTED) {
        break;
      }
    }
    return Promise.all(
      visibleSpots.map(async (fullSpot) => {
        const {
          photoIds: _photoIds,
          createdBy,
          allowAdminPhotos: _allowAdminPhotos,
          adminPhotosAddedAt: _adminPhotosAddedAt,
          adminPhotosUnseen: _adminPhotosUnseen,
          publicationStatus,
          deletionRequested: _deletionRequested,
          needsWork,
          workCompletedAt: _workCompletedAt,
          ...spot
        } = fullSpot;
        return {
          ...spot,
          createdByName: await contributorName(ctx, createdBy, spot.createdByName, profiles),
          isMine: identity !== null && createdBy === identity.tokenIdentifier,
          isPrivate: publicationStatus === "private",
          needsWork: needsWork === true,
          previewPhotoUrl: await previewPhotoUrl(ctx, fullSpot),
        };
      }),
    );
  },
});

/** Submitted spots and admin-removal notices visible only to their creator. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const spots = await ctx.db
      .query("spots")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", identity.tokenIdentifier))
      .order("desc")
      .take(MAX_SPOTS_LISTED);
    const removals = await ctx.db
      .query("spotRemovals")
      .withIndex("by_createdBy_and_spotCreationTime", (q) =>
        q.eq("createdBy", identity.tokenIdentifier),
      )
      .order("desc")
      .take(MAX_SPOTS_LISTED);
    const ownedSpots = await Promise.all(
      spots
        .filter((spot) => !spot.deletionRequested)
        .map(async (spot) => ({
          status:
            spot.publicationStatus === "private" || spot.publicationStatus === "needs_changes"
              ? spot.publicationStatus
              : (await spotIsPublished(ctx, spot))
                ? ("active" as const)
                : ("pending" as const),
          _id: spot._id,
          _creationTime: spot._creationTime,
          name: spot.name,
          types: spot.types,
          bustFactor: spot.bustFactor,
          // Owner-only, so the add form can warn about the owner's own pending duplicates.
          latitude: spot.latitude,
          longitude: spot.longitude,
          adminPhotosUnseen: spot.adminPhotosUnseen ?? false,
        })),
    );
    return [
      ...ownedSpots,
      ...removals.map(({ spotId, spotCreationTime, name, reason, strikeNumber }) => ({
        status: "removed" as const,
        _id: spotId,
        _creationTime: spotCreationTime,
        name,
        reason,
        strikeNumber,
      })),
    ]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, MAX_SPOTS_LISTED);
  },
});

/**
 * One spot with signed URLs for every photo, for the detail screen.
 * isOwner drives the edit/delete menu; photoIds are returned only to the
 * owner, whose edit form needs them.
 */
export const get = query({
  // A string, not v.id: the id comes from a route param, and a malformed deep
  // link should read as "no such spot" rather than a validation error.
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("spots", args.id);
    const spot = id ? await ctx.db.get("spots", id) : null;
    if (!spot || spot.deletionRequested) {
      if (!id) {
        return null;
      }
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return null;
      }
      const removal = await ctx.db
        .query("spotRemovals")
        .withIndex("by_spotId", (q) => q.eq("spotId", id))
        .unique();
      if (!removal || removal.createdBy !== identity.tokenIdentifier) {
        return null;
      }
      return {
        status: "removed" as const,
        _id: removal.spotId,
        _creationTime: removal.spotCreationTime,
        name: removal.name,
        reason: removal.reason,
        ownerMessage: removal.ownerMessage,
        removedAt: removal.removedAt,
        strikeNumber: removal.strikeNumber,
      };
    }
    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity !== null && spot.createdBy === identity.tokenIdentifier;
    const isPrivate = spot.publicationStatus === "private";
    const needsChanges = spot.publicationStatus === "needs_changes";
    const isPublished = await spotIsPublished(ctx, spot);
    // Private spots are unpublished, so this also keeps them to their owner.
    if (!isPublished && !isOwner) {
      return null;
    }
    const favorite = identity
      ? await ctx.db
          .query("favorites")
          .withIndex("by_userId_and_spotId", (q) =>
            q.eq("userId", identity.tokenIdentifier).eq("spotId", spot._id),
          )
          .unique()
      : null;
    const myReport = identity
      ? await ctx.db
          .query("spotReports")
          .withIndex("by_spotId_and_reportedBy", (q) =>
            q.eq("spotId", spot._id).eq("reportedBy", identity.tokenIdentifier),
          )
          .unique()
      : null;
    const photoUrls = (
      await Promise.all(spot.photoIds.map((photoId) => ctx.storage.getUrl(photoId)))
    ).filter((url): url is string => url !== null);
    // The fix's photos stay apart from photoUrls, which the owner's edit form pairs with photoIds.
    const work = await spotWorkFor(ctx, spot._id);
    const fix =
      work?.acceptedAt === undefined
        ? null
        : {
            by: await contributorName(ctx, work.submittedBy),
            at: work.acceptedAt,
            photoUrls: (
              await Promise.all(work.photoIds.map((photoId) => ctx.storage.getUrl(photoId)))
            ).filter((url): url is string => url !== null),
          };
    const pendingFix =
      work && work.acceptedAt === undefined
        ? identity?.tokenIdentifier === work.submittedBy
          ? ("mine" as const)
          : ("other" as const)
        : null;
    const {
      photoIds,
      allowAdminPhotos,
      adminPhotosAddedAt,
      adminPhotosUnseen,
      createdBy: _createdBy,
      publicationStatus: _publicationStatus,
      deletionRequested: _deletionRequested,
      needsWork,
      workCompletedAt,
      ...publicFields
    } = spot;
    return {
      status: "active" as const,
      ...publicFields,
      needsWork: needsWork === true,
      // Unlike fix, this outlives the sender's account, so it alone says the tag is retired.
      isFixed: workCompletedAt !== undefined,
      fix,
      pendingFix,
      createdByName: await contributorName(ctx, spot.createdBy, spot.createdByName),
      photoUrls,
      isOwner,
      isFavorite: favorite !== null,
      // The caller's own open report, so they can see it's being reviewed.
      myReportReason: myReport?.reason ?? null,
      isPendingReview: !isPublished && !isPrivate && !needsChanges,
      isPrivate,
      photoIds: isOwner ? photoIds : null,
      // Only the owner can load an unpublished spot, so this never reaches anyone else.
      changesRequested: needsChanges
        ? ((await spotModerationFor(ctx, spot._id))?.requestedChanges ?? null)
        : null,
      ...(isOwner
        ? {
            allowAdminPhotos: allowAdminPhotos ?? false,
            adminPhotosAddedAt,
            adminPhotosUnseen: adminPhotosUnseen ?? false,
          }
        : {}),
    };
  },
});

export const create = mutation({
  // Only creation takes the tag; afterwards it changes through setNeedsWork.
  args: { ...spotFields.fields, needsWork: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { visibility = "public", needsWork = false, ...fields } = args;
    const isPrivate = visibility === "private";
    const identity = await requireCanContribute(ctx);
    validateSpotFields(fields);
    if (isPrivate && needsWork) {
      throw new Error(PRIVATE_NEEDS_WORK_ERROR);
    }
    if (needsWork && !describesWork(fields.notes, fields.photoIds.length)) {
      throw new Error(NEEDS_WORK_DETAILS_ERROR);
    }
    if (isPrivate) {
      await assertPrivateAllowance(ctx, identity.tokenIdentifier, null);
    }
    await assertPhotosUnclaimed(ctx, fields.photoIds, null);
    await consumeUploads(ctx, identity.tokenIdentifier, fields.photoIds);
    const id = await ctx.db.insert("spots", {
      ...fields,
      name: fields.name.trim(),
      // Admins never see a private spot, so the permission is meaningless there.
      allowAdminPhotos:
        !isPrivate && fields.photoIds.length === 0 && fields.allowAdminPhotos === true,
      needsWork,
      createdBy: identity.tokenIdentifier,
      createdByName: await contributorName(ctx, identity.tokenIdentifier, identity.name),
      // Only the verified Clerk role can skip review; client arguments cannot set this status.
      publicationStatus: isPrivate
        ? "private"
        : identity.role === "admin"
          ? "published"
          : "pending",
    });
    await claimPhotos(ctx, fields.photoIds, id);
    const spot = await ctx.db.get("spots", id);
    if (!spot) {
      throw new Error("Spot not found after creation.");
    }
    // Nobody else can see a private spot, so there is nothing to review.
    if (!isPrivate) {
      await recordNewSpotModeration(ctx, spot);
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("spots"),
    ...spotFields.fields,
    expectedAdminPhotosAddedAt: v.optional(v.number()),
    // The owner's one reply when resubmitting a spot sent back for changes.
    ownerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      id,
      expectedAdminPhotosAddedAt,
      visibility = "public",
      ownerNote: rawOwnerNote,
      ...fields
    } = args;
    const { spot: existing, identity } = await requireOwnedSpot(ctx, id, true);
    const ownerNote = rawOwnerNote?.trim() || undefined;
    if (ownerNote && ownerNote.length > MAX_OWNER_NOTE_LENGTH) {
      throw new Error(`Keep the note for the reviewer to ${MAX_OWNER_NOTE_LENGTH} characters.`);
    }
    // An editor opened before an admin upload must not silently drop the new photos.
    if (existing.adminPhotosAddedAt !== expectedAdminPhotosAddedAt) {
      throw new Error(
        "Admin photos were added while you were editing. Reopen the editor to see them before saving.",
      );
    }
    validateSpotFields(fields);
    const wasPrivate = existing.publicationStatus === "private";
    const isPrivate = visibility === "private";
    const keepsNeedsWork = !isPrivate && existing.needsWork === true;
    if (keepsNeedsWork && !describesWork(fields.notes, fields.photoIds.length)) {
      throw new Error(
        "This spot is tagged as needing work, so it needs notes or photos showing the fix. Remove the tag to clear both.",
      );
    }
    if (isPrivate && !wasPrivate) {
      // Going private would otherwise take a reported spot out of the queue unreviewed.
      const moderation = await spotModerationFor(ctx, id);
      if ((moderation?.openReportCount ?? 0) > 0) {
        throw new Error(
          "This spot has open reports. It can be made private once an admin has reviewed them.",
        );
      }
      // Someone has done the work, so hiding the spot before an admin decides would bury it.
      const work = await spotWorkFor(ctx, id);
      if (work && work.acceptedAt === undefined) {
        throw new Error(
          "Someone sent photos of a fix for this spot. It can be made private once an admin has reviewed them.",
        );
      }
      await assertPrivateAllowance(ctx, identity.tokenIdentifier, id);
    }
    await assertPhotosUnclaimed(ctx, fields.photoIds, id);
    const before = new Set(existing.photoIds);
    const after = new Set(fields.photoIds);
    const added = fields.photoIds.filter((photoId) => !before.has(photoId));
    await consumeUploads(ctx, identity.tokenIdentifier, added);
    await claimPhotos(ctx, added, id);
    // Photos dropped from the spot would otherwise be orphaned in storage.
    await releasePhotos(
      ctx,
      existing.photoIds.filter((photoId) => !after.has(photoId)),
    );
    // replace, not patch: an omitted optional field (notes, surface) must
    // clear the stored value, and patch leaves absent keys untouched.
    await ctx.db.replace("spots", id, {
      ...fields,
      name: fields.name.trim(),
      allowAdminPhotos:
        !isPrivate && fields.photoIds.length === 0 && fields.allowAdminPhotos === true,
      adminPhotosAddedAt: existing.adminPhotosAddedAt,
      workCompletedAt: existing.workCompletedAt,
      adminPhotosUnseen: fields.photoIds.length > 0 && existing.adminPhotosUnseen === true,
      // The edit form doesn't carry the tag, so keep it, unless the spot is going private.
      needsWork: keepsNeedsWork,
      createdBy: existing.createdBy,
      createdByName: existing.createdByName,
      // Only owners can edit, so an admin here is editing their own spot, which skips review
      // just as creating it did.
      publicationStatus: isPrivate
        ? "private"
        : identity.role === "admin"
          ? "published"
          : "pending",
    });
    const updated = await ctx.db.get("spots", id);
    if (!updated) {
      throw new Error("Spot not found after update.");
    }
    if (isPrivate) {
      // Open reports were ruled out above, so this only drops the review row.
      if (!wasPrivate) {
        await clearSpotModeration(ctx, id);
      }
    } else if (wasPrivate) {
      // Its first public submission, so it queues as new rather than edited.
      await recordNewSpotModeration(ctx, updated, Date.now());
    } else {
      await queueEditedSpot(ctx, updated, {
        adminEditor: identity.role === "admin" ? identity.tokenIdentifier : undefined,
        resubmitted: existing.publicationStatus === "needs_changes",
        ownerNote,
      });
    }
    return null;
  },
});

/** One tap from the detail screen; the same transition as editing visibility to public. */
export const makePublic = mutation({
  args: { id: v.id("spots") },
  handler: async (ctx, { id }) => {
    const { spot, identity } = await requireOwnedSpot(ctx, id, true);
    if (spot.publicationStatus !== "private") {
      throw new Error("This spot is already public.");
    }
    await ctx.db.patch("spots", id, {
      publicationStatus: identity.role === "admin" ? "published" : "pending",
    });
    const updated = await ctx.db.get("spots", id);
    if (!updated) {
      throw new Error("Spot not found after update.");
    }
    await recordNewSpotModeration(ctx, updated, Date.now());
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("spots") },
  handler: async (ctx, args) => {
    const { spot } = await requireOwnedSpot(ctx, args.id);
    await releasePhotos(ctx, spot.photoIds);
    await clearSpotModeration(ctx, args.id);
    await clearSpotWork(ctx, args.id);
    await scheduleSpotDeletion(ctx, args.id);
    return null;
  },
});

/** Continues a soft-deleted spot's cascade without exceeding transaction limits. */
export const removeFavoriteBatch = internalMutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, args): Promise<null> => {
    const spot = await ctx.db.get("spots", args.spotId);
    // A stray internal call must never remove favourites from a non-deleted spot.
    if (spot && !spot.deletionRequested) {
      return null;
    }

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_spotId_and_userId", (q) => q.eq("spotId", args.spotId))
      .take(FAVORITE_DELETE_BATCH_SIZE);
    for (const favorite of favorites) {
      await ctx.db.delete("favorites", favorite._id);
    }

    if (favorites.length === FAVORITE_DELETE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.spots.removeFavoriteBatch, args);
    } else if (spot?.deletionRequested) {
      await ctx.db.delete("spots", spot._id);
    }
    return null;
  },
});

/**
 * Ledger entry for a file the caller just stored; called only from the
 * /upload HTTP action, in the same request as the store. Identity comes
 * from the request's token, never from an argument.
 */
export const recordUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await requireCanContribute(ctx);
    await ctx.db.insert("uploads", {
      storageId: args.storageId,
      uploadedBy: identity.tokenIdentifier,
    });
    return null;
  },
});

/**
 * Deletes a file the caller uploaded but never attached, e.g. when saving
 * the form failed after the upload. Bound to the uploader, so nobody can
 * delete another user's pending upload even with its id in hand.
 */
export const discardUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const upload = await uploadRef(ctx, args.storageId);
    if (!upload || upload.uploadedBy !== identity.tokenIdentifier) {
      throw new Error("That isn't one of your pending uploads.");
    }
    await ctx.db.delete("uploads", upload._id);
    await ctx.storage.delete(args.storageId);
    return null;
  },
});

/** Consent changes do not edit public content or reopen moderation. */
export const setAdminPhotoPermission = mutation({
  args: { id: v.id("spots"), allowed: v.boolean() },
  handler: async (ctx, { id, allowed }) => {
    const { spot } = await requireOwnedSpot(ctx, id, allowed);
    if (allowed && spot.photoIds.length > 0) throw new Error("This spot already has photos.");
    if (allowed && spot.publicationStatus === "private") {
      throw new Error("Admins can't see private spots, so they can't add photos to them.");
    }
    await ctx.db.patch("spots", id, { allowAdminPhotos: allowed });
    return null;
  },
});

/**
 * The tag is the owner's consent rather than new spot content, so like photo
 * permission it changes without sending the spot back to review.
 */
export const setNeedsWork = mutation({
  args: { id: v.id("spots"), needsWork: v.boolean() },
  handler: async (ctx, { id, needsWork }) => {
    const { spot } = await requireOwnedSpot(ctx, id, needsWork);
    if (needsWork && spot.publicationStatus === "private") {
      throw new Error(PRIVATE_NEEDS_WORK_ERROR);
    }
    if (needsWork && !describesWork(spot.notes, spot.photoIds.length)) {
      throw new Error(NEEDS_WORK_DETAILS_ERROR);
    }
    if (needsWork && spot.workCompletedAt !== undefined) {
      throw new Error("This spot has already been fixed up, so it can't be tagged again.");
    }
    if (!needsWork) {
      // The work is already done by then; removing the tag would only take the credit away.
      const work = await spotWorkFor(ctx, id);
      if (work && work.acceptedAt === undefined) {
        throw new Error(
          "Someone sent photos of a fix for this spot. The tag can't be removed while an admin reviews them.",
        );
      }
    }
    await ctx.db.patch("spots", id, { needsWork });
    return null;
  },
});

/** Admins may fill an empty gallery, but cannot edit details or resolve reviews here. */
export const addAdminPhotos = mutation({
  args: { id: v.id("spots"), photoIds: v.array(v.id("_storage")) },
  handler: async (ctx, { id, photoIds }) => {
    const identity = await requireAdmin(ctx);
    await requireCanContribute(ctx);
    const spot = await ctx.db.get("spots", id);
    if (!spot || spot.deletionRequested) throw new Error("Spot not found.");
    if (!spot.allowAdminPhotos) throw new Error("The contributor has not given photo permission.");
    if (spot.photoIds.length > 0)
      throw new Error("This spot already has photos. Reopen it to see the latest version.");
    if (
      photoIds.length === 0 ||
      photoIds.length > MAX_PHOTOS ||
      new Set(photoIds).size !== photoIds.length
    ) {
      throw new Error(`Add between 1 and ${MAX_PHOTOS} different photos.`);
    }
    await assertPhotosUnclaimed(ctx, photoIds, null);
    await consumeUploads(ctx, identity.tokenIdentifier, photoIds);
    await claimPhotos(ctx, photoIds, id);
    await ctx.db.patch("spots", id, {
      photoIds,
      allowAdminPhotos: false,
      adminPhotosAddedAt: Date.now(),
      adminPhotosUnseen: true,
    });
    // A decision screen opened before the upload must not publish photos it never showed.
    await bumpReviewVersion(ctx, id);
    return null;
  },
});

/** Acknowledges only the upload the owner actually opened, preserving newer updates. */
export const markAdminPhotosSeen = mutation({
  args: { id: v.id("spots"), addedAt: v.number() },
  handler: async (ctx, { id, addedAt }) => {
    const { spot } = await requireOwnedSpot(ctx, id);
    if (spot.adminPhotosAddedAt === addedAt && spot.adminPhotosUnseen) {
      await ctx.db.patch("spots", id, { adminPhotosUnseen: false });
    }
    return null;
  },
});
