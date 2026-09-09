import type { MutationCtx, QueryCtx } from "./_generated/server";
import { publicDisplayName } from "./displayNames";

export async function profileFor(ctx: QueryCtx | MutationCtx, userIdentifier: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", userIdentifier))
    .unique();
}

/** Read the current name so a rename updates old spots without an unbounded rewrite. */
export async function contributorName(
  ctx: QueryCtx | MutationCtx,
  userIdentifier: string,
  legacyName?: string,
  profiles?: Map<string, ReturnType<typeof profileFor>>,
) {
  let pending = profiles?.get(userIdentifier);
  if (!pending) {
    pending = profileFor(ctx, userIdentifier);
    profiles?.set(userIdentifier, pending);
  }
  // Cache the lookup, not the resolved name: legacy names can differ between spots.
  const profile = await pending;
  return publicDisplayName(profile?.displayName ?? legacyName);
}
