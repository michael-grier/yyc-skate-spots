import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

// A user cannot save more spots than the city-scale spot query exposes.
const MAX_FAVORITES_LISTED = 500;

async function requireIdentity(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("You must be signed in to do that.");
  }
  return identity;
}

/** Finds the caller's row for one spot through the uniqueness index. */
async function favoriteRef(ctx: QueryCtx | MutationCtx, userId: string, spotId: Id<"spots">) {
  return await ctx.db
    .query("favorites")
    .withIndex("by_userId_and_spotId", (q) => q.eq("userId", userId).eq("spotId", spotId))
    .unique();
}

/** Saves or unsaves one existing spot for the authenticated caller. */
export const toggle = mutation({
  args: { spotId: v.id("spots") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const spot = await ctx.db.get("spots", args.spotId);
    if (!spot || spot.deletionRequested) {
      throw new Error("Spot not found.");
    }

    const existing = await favoriteRef(ctx, identity.tokenIdentifier, args.spotId);
    if (existing) {
      await ctx.db.delete("favorites", existing._id);
      return false;
    }

    await ctx.db.insert("favorites", {
      userId: identity.tokenIdentifier,
      spotId: args.spotId,
    });
    return true;
  },
});

/** The caller's saved spots, most recently saved first, for Profile. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("desc")
      .take(MAX_FAVORITES_LISTED);
    const spots = await Promise.all(
      favorites.map((favorite) => ctx.db.get("spots", favorite.spotId)),
    );

    return spots.flatMap((spot) =>
      spot && !spot.deletionRequested
        ? [
            {
              _id: spot._id,
              _creationTime: spot._creationTime,
              name: spot.name,
              types: spot.types,
              bustFactor: spot.bustFactor,
            },
          ]
        : [],
    );
  },
});
