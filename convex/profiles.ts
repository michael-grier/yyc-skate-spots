import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./auth";
import { displayNameError, publicDisplayName } from "./displayNames";
import { profileFor } from "./profileModel";

/** The editor uses a provider name until the caller saves an app-specific name. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const profile = await profileFor(ctx, identity.tokenIdentifier);
    return { displayName: publicDisplayName(profile?.displayName ?? identity.name) ?? null };
  },
});

export const setDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const error = displayNameError(args.displayName);
    if (error) throw new ConvexError(error);
    // Do not recreate personal data while the account-deletion action is cleaning it up.
    const deletion = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", identity.tokenIdentifier))
      .unique();
    if (deletion) throw new ConvexError("Finish deleting your account before changing its name.");
    const displayName = args.displayName.trim().normalize("NFC");
    const existing = await profileFor(ctx, identity.tokenIdentifier);
    if (existing) {
      await ctx.db.patch("profiles", existing._id, { displayName });
    } else {
      await ctx.db.insert("profiles", { userIdentifier: identity.tokenIdentifier, displayName });
    }
    return null;
  },
});
