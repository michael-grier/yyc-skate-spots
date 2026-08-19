import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { bustFactor, spotType, surface } from "./schema";

// Caps chosen so a spot document stays far under Convex's 1MB limit and
// the add-spot form has concrete limits to enforce.
const MAX_PHOTOS = 6;
const MAX_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 2000;
// City-scale app: a plain bounded read covers Calgary's realistic spot count.
// Revisit with pagination + geo indexing if the table ever approaches this.
const MAX_SPOTS_LISTED = 500;

// Everything a submitter provides; ownership fields are always derived
// server-side from the authenticated identity, never accepted as args.
const spotFields = v.object({
  name: v.string(),
  type: spotType,
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
  return spot;
}

function validateSpotFields(fields: { name: string; notes?: string; photoIds: unknown[] }) {
  if (fields.name.trim().length === 0 || fields.name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be 1–${MAX_NAME_LENGTH} characters.`);
  }
  if (fields.notes !== undefined && fields.notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be at most ${MAX_NOTES_LENGTH} characters.`);
  }
  if (fields.photoIds.length > MAX_PHOTOS) {
    throw new Error(`A spot can have at most ${MAX_PHOTOS} photos.`);
  }
}

/** All spots plus a first-photo URL for the map's preview card. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const spots = await ctx.db.query("spots").take(MAX_SPOTS_LISTED);
    return Promise.all(
      spots.map(async (spot) => ({
        ...spot,
        previewPhotoUrl:
          spot.photoIds.length > 0 ? await ctx.storage.getUrl(spot.photoIds[0]) : null,
      })),
    );
  },
});

/** One spot with signed URLs for every photo, for the detail screen. */
export const get = query({
  args: { id: v.id("spots") },
  handler: async (ctx, args) => {
    const spot = await ctx.db.get("spots", args.id);
    if (!spot) {
      return null;
    }
    const photoUrls = (
      await Promise.all(spot.photoIds.map((photoId) => ctx.storage.getUrl(photoId)))
    ).filter((url): url is string => url !== null);
    return { ...spot, photoUrls };
  },
});

export const create = mutation({
  args: spotFields.fields,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    validateSpotFields(args);
    return await ctx.db.insert("spots", {
      ...args,
      name: args.name.trim(),
      createdBy: identity.tokenIdentifier,
      createdByName: identity.name,
    });
  },
});

export const update = mutation({
  args: { id: v.id("spots"), ...spotFields.fields },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await requireOwnedSpot(ctx, id);
    validateSpotFields(fields);
    // Photos dropped from the spot would otherwise be orphaned in storage.
    const kept = new Set(fields.photoIds);
    await Promise.all(
      existing.photoIds
        .filter((photoId) => !kept.has(photoId))
        .map((photoId) => ctx.storage.delete(photoId)),
    );
    await ctx.db.patch("spots", id, { ...fields, name: fields.name.trim() });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("spots") },
  handler: async (ctx, args) => {
    const spot = await requireOwnedSpot(ctx, args.id);
    await Promise.all(spot.photoIds.map((photoId) => ctx.storage.delete(photoId)));
    await ctx.db.delete("spots", args.id);
    return null;
  },
});

/** Signed URL the app POSTs a photo to before create/update. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
