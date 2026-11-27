import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./auth";

// The badge shows "9+" past this, so counting further would be wasted reads.
const UNREAD_COUNT_CAP = 10;
const MAX_MARK_READ = 100;

/** The caller's updates, newest first. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("notices")
      .withIndex("by_recipient", (q) => q.eq("recipient", identity.tokenIdentifier))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map(({ recipient: _recipient, ...notice }) => notice),
    };
  },
});

/** Unread updates for the badge, capped at UNREAD_COUNT_CAP. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }
    const unread = await ctx.db
      .query("notices")
      .withIndex("by_recipient_and_readAt", (q) =>
        q.eq("recipient", identity.tokenIdentifier).eq("readAt", undefined),
      )
      .take(UNREAD_COUNT_CAP);
    return unread.length;
  },
});

/** Marks the updates the caller has seen. Ids that aren't theirs are ignored. */
export const markRead = mutation({
  args: { ids: v.array(v.id("notices")) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (args.ids.length > MAX_MARK_READ) {
      throw new Error(`Mark at most ${MAX_MARK_READ} updates at a time.`);
    }
    const readAt = Date.now();
    for (const id of args.ids) {
      const notice = await ctx.db.get("notices", id);
      if (notice && notice.recipient === identity.tokenIdentifier && notice.readAt === undefined) {
        await ctx.db.patch("notices", id, { readAt });
      }
    }
    return null;
  },
});
