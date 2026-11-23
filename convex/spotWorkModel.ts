import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** The spot's one fix row: pending, or the approved fix it credits. */
export async function spotWorkFor(ctx: QueryCtx | MutationCtx, spotId: Id<"spots">) {
  return await ctx.db
    .query("spotWork")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .unique();
}

/** Fix photos never join spot.photoIds, so every path that drops a row deletes its files. */
export async function deleteSpotWork(ctx: MutationCtx, work: Doc<"spotWork">) {
  for (const photoId of work.photoIds) await ctx.storage.delete(photoId);
  await ctx.db.delete("spotWork", work._id);
}

/** Clears a departing spot's fix, pending or approved. */
export async function clearSpotWork(ctx: MutationCtx, spotId: Id<"spots">) {
  const work = await spotWorkFor(ctx, spotId);
  if (work) await deleteSpotWork(ctx, work);
}
