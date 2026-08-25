import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

/** Returns the verified Clerk identity or rejects an anonymous call. */
export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("You must be signed in to do that.");
  }
  return identity;
}

/** Admin access comes only from the signed Clerk JWT, never a client argument. */
export async function requireAdmin(ctx: AuthCtx) {
  const identity = await requireIdentity(ctx);
  if (identity.role !== "admin") {
    throw new Error("Administrator access required.");
  }
  return identity;
}

/** Loads the moderation record for an authenticated identity, when one exists. */
export async function userModerationFor(ctx: AuthCtx, userIdentifier: string) {
  return await ctx.db
    .query("userModeration")
    .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", userIdentifier))
    .unique();
}

/** Rejects writes covered by a contribution ban while leaving read access intact. */
export async function requireCanContribute(ctx: AuthCtx) {
  const identity = await requireIdentity(ctx);
  const moderation = await userModerationFor(ctx, identity.tokenIdentifier);
  if (moderation?.isBanned) {
    throw new Error("Your contribution access has been removed.");
  }
  return identity;
}
