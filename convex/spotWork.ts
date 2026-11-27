import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin, requireCanContribute } from "./auth";
import { MAX_FIX_DETAILS_LENGTH, MAX_FIX_PHOTOS } from "./constants";
import { spotIsPublished } from "./moderationModel";
import { consumeUploads } from "./spots";
import { deleteSpotWork, spotWorkFor } from "./spotWorkModel";

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
    // The credit is for someone else's work; an owner fixing their own spot just removes the tag.
    if (spot.createdBy === identity.tokenIdentifier) {
      throw new Error("You can't send a fix for your own spot.");
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
    if (details && details.length > MAX_FIX_DETAILS_LENGTH) {
      throw new Error(`Keep the note to ${MAX_FIX_DETAILS_LENGTH} characters or fewer.`);
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

// Decisions name the fix the admin saw, not its spot, so one made after another admin has
// rejected it can't land on a newer fix sent in the meantime. Deleting a spot deletes its
// fix in the same transaction, so a pending fix always has a live spot.
const NO_PENDING_FIX_ERROR = "This fix has already been reviewed.";

/** Approving ends the tag for good and keeps the row as the credit for its photos. */
export const accept = mutation({
  args: { workId: v.id("spotWork") },
  handler: async (ctx, { workId }) => {
    await requireAdmin(ctx);
    const work = await ctx.db.get("spotWork", workId);
    if (!work || work.acceptedAt !== undefined) throw new Error(NO_PENDING_FIX_ERROR);
    const acceptedAt = Date.now();
    await ctx.db.patch("spotWork", workId, { acceptedAt });
    await ctx.db.patch("spots", work.spotId, { needsWork: false, workCompletedAt: acceptedAt });
    return null;
  },
});

/**
 * Takes down approved photos that turn out to break the standards. Removing the spot would
 * strike its owner for someone else's photos, so this drops only the fix and its credit; the
 * spot stays fixed, as when the sender deletes their account.
 */
export const removeApproved = mutation({
  args: { workId: v.id("spotWork") },
  handler: async (ctx, { workId }) => {
    await requireAdmin(ctx);
    const work = await ctx.db.get("spotWork", workId);
    if (!work || work.acceptedAt === undefined) throw new Error("This fix isn't on the spot.");
    await deleteSpotWork(ctx, work);
    return null;
  },
});

/** Rejecting deletes the photos and lets someone else send a fix. */
export const reject = mutation({
  args: { workId: v.id("spotWork") },
  handler: async (ctx, { workId }) => {
    await requireAdmin(ctx);
    const work = await ctx.db.get("spotWork", workId);
    if (!work || work.acceptedAt !== undefined) throw new Error(NO_PENDING_FIX_ERROR);
    await deleteSpotWork(ctx, work);
    return null;
  },
});
