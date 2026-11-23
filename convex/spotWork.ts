import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin, requireCanContribute } from "./auth";
import { MAX_FIX_PHOTOS } from "./constants";
import { spotIsPublished } from "./moderationModel";
import { consumeUploads } from "./spots";
import { deleteSpotWork, spotWorkFor } from "./spotWorkModel";

const MAX_DETAILS_LENGTH = 500;

/**
 * Sends photos of a finished fix for admin review. Only one fix can wait per spot:
 * the work is physical, so a second person would be fixing what is already fixed.
 */
export const submit = mutation({
  args: {
    spotId: v.id("spots"),
    photoIds: v.array(v.id("_storage")),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // The photos become public once approved, so this needs the same rights as adding a spot.
    const identity = await requireCanContribute(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot || spot.deletionRequested || !(await spotIsPublished(ctx, spot))) {
      throw new Error("Spot not found.");
    }
    if (!spot.needsWork) {
      throw new Error("This spot isn't tagged as needing work.");
    }
    if (await spotWorkFor(ctx, spot._id)) {
      throw new Error("Someone has already sent photos of a fix for this spot.");
    }
    if (
      args.photoIds.length === 0 ||
      args.photoIds.length > MAX_FIX_PHOTOS ||
      new Set(args.photoIds).size !== args.photoIds.length
    ) {
      throw new Error(`Add 1–${MAX_FIX_PHOTOS} different photos of the fix.`);
    }
    const details = args.details?.trim();
    if (details && details.length > MAX_DETAILS_LENGTH) {
      throw new Error(`Keep the note under ${MAX_DETAILS_LENGTH} characters.`);
    }
    await consumeUploads(ctx, identity.tokenIdentifier, args.photoIds);
    await ctx.db.insert("spotWork", {
      spotId: spot._id,
      submittedBy: identity.tokenIdentifier,
      photoIds: args.photoIds,
      ...(details ? { details } : {}),
    });
    return null;
  },
});

/** Approving ends the tag for good and keeps the row as the credit for its photos. */
export const accept = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, { spotId }) => {
    await requireAdmin(ctx);
    const spot = await ctx.db.get("spots", spotId);
    const work = await spotWorkFor(ctx, spotId);
    if (!spot || spot.deletionRequested || !work || work.acceptedAt !== undefined) {
      throw new Error("There's no fix waiting for review on this spot.");
    }
    const acceptedAt = Date.now();
    await ctx.db.patch("spotWork", work._id, { acceptedAt });
    await ctx.db.patch("spots", spotId, { needsWork: false, workCompletedAt: acceptedAt });
    return null;
  },
});

/** Rejecting deletes the photos and lets someone else send a fix. */
export const reject = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, { spotId }) => {
    await requireAdmin(ctx);
    const work = await spotWorkFor(ctx, spotId);
    if (!work || work.acceptedAt !== undefined) {
      throw new Error("There's no fix waiting for review on this spot.");
    }
    await deleteSpotWork(ctx, work);
    return null;
  },
});
