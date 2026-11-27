import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { MODERATION_FIXTURE_OWNER, MODERATION_FIXTURE_REPORTER, SEED_OWNER } from "./constants";

type NewNotice = Omit<Doc<"notices">, "_id" | "_creationTime" | "readAt">;

// Seed and fixture identities belong to no account, so nobody could ever read their notices.
const ACCOUNTLESS = new Set([SEED_OWNER, MODERATION_FIXTURE_OWNER, MODERATION_FIXTURE_REPORTER]);

/**
 * Sends one update, inside the mutation that made the decision. Skips anyone
 * whose account deletion has started, so the purge can't be undone by a late notice.
 */
export async function insertNotice(ctx: MutationCtx, notice: NewNotice) {
  if (ACCOUNTLESS.has(notice.recipient)) {
    return;
  }
  const deletion = await ctx.db
    .query("accountDeletionRequests")
    .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", notice.recipient))
    .unique();
  if (deletion) {
    return;
  }
  await ctx.db.insert("notices", notice);
}
