import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { bustFactor, spotType, surface } from "./schema";

// Caps chosen so a spot document stays far under Convex's 1MB limit and
// the add-spot form has concrete limits to enforce.
const MAX_PHOTOS = 6;
const MAX_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 2000;
// City-scale app: one bounded read covers Calgary's realistic spot count.
// Revisit with pagination + geo indexing if the table ever approaches this.
const MAX_SPOTS_LISTED = 500;

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
});

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("You must be signed in to do that.");
  }
  return identity;
}

/** Loads a spot and verifies the caller owns it; throws otherwise. */
async function requireOwnedSpot(ctx: MutationCtx, id: Id<"spots">) {
  const identity = await requireIdentity(ctx);
  const spot = await ctx.db.get("spots", id);
  if (!spot) {
    throw new Error("Spot not found.");
  }
  if (spot.createdBy !== identity.tokenIdentifier) {
    throw new Error("Only the person who added a spot can change it.");
  }
  return { spot, identity };
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
async function consumeUploads(ctx: MutationCtx, uploader: string, photoIds: Id<"_storage">[]) {
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
async function releasePhotos(ctx: MutationCtx, photoIds: Id<"_storage">[]) {
  for (const photoId of photoIds) {
    const ref = await photoRef(ctx, photoId);
    if (ref) {
      await ctx.db.delete("spotPhotos", ref._id);
    }
    await ctx.storage.delete(photoId);
  }
}

/**
 * All spots plus a first-photo URL for the map's preview card.
 * Raw photoIds and the owner's identity key never leave the server —
 * exposing storage IDs is what would let another user attach (and later
 * destroy) someone else's photos.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // isMine lets the map style the caller's own pins; the query is
    // identity-aware, so it re-runs on sign-in and sign-out.
    const identity = await ctx.auth.getUserIdentity();
    const spots = await ctx.db.query("spots").take(MAX_SPOTS_LISTED);
    return Promise.all(
      spots.map(async ({ photoIds, createdBy, ...spot }) => ({
        ...spot,
        isMine: identity !== null && createdBy === identity.tokenIdentifier,
        previewPhotoUrl: photoIds.length > 0 ? await ctx.storage.getUrl(photoIds[0]) : null,
      })),
    );
  },
});

/** The caller's own spots, newest first, for the profile's "Your spots" list. */
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
    return spots.map(({ _id, _creationTime, name, types, bustFactor }) => ({
      _id,
      _creationTime,
      name,
      types,
      bustFactor,
    }));
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
    if (!spot) {
      return null;
    }
    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity !== null && spot.createdBy === identity.tokenIdentifier;
    const favorite = identity
      ? await ctx.db
          .query("favorites")
          .withIndex("by_userId_and_spotId", (q) =>
            q.eq("userId", identity.tokenIdentifier).eq("spotId", spot._id),
          )
          .unique()
      : null;
    const photoUrls = (
      await Promise.all(spot.photoIds.map((photoId) => ctx.storage.getUrl(photoId)))
    ).filter((url): url is string => url !== null);
    const { photoIds, createdBy: _createdBy, ...publicFields } = spot;
    return {
      ...publicFields,
      photoUrls,
      isOwner,
      isFavorite: favorite !== null,
      photoIds: isOwner ? photoIds : null,
    };
  },
});

export const create = mutation({
  args: spotFields.fields,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    validateSpotFields(args);
    await assertPhotosUnclaimed(ctx, args.photoIds, null);
    await consumeUploads(ctx, identity.tokenIdentifier, args.photoIds);
    const id = await ctx.db.insert("spots", {
      ...args,
      name: args.name.trim(),
      createdBy: identity.tokenIdentifier,
      createdByName: identity.name,
    });
    await claimPhotos(ctx, args.photoIds, id);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("spots"), ...spotFields.fields },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const { spot: existing, identity } = await requireOwnedSpot(ctx, id);
    validateSpotFields(fields);
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
      createdBy: existing.createdBy,
      createdByName: existing.createdByName,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("spots") },
  handler: async (ctx, args) => {
    const { spot } = await requireOwnedSpot(ctx, args.id);
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_spotId_and_userId", (q) => q.eq("spotId", args.id))
      .collect();
    // Convex has no foreign-key cascade, so keep spot and favorite deletion
    // in this transaction to prevent stale Profile rows.
    for (const favorite of favorites) {
      await ctx.db.delete("favorites", favorite._id);
    }
    await releasePhotos(ctx, spot.photoIds);
    await ctx.db.delete("spots", args.id);
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
    const identity = await requireIdentity(ctx);
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
