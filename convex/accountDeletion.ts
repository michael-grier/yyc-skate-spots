import { decodeJwt, importPKCS8, SignJWT } from "jose";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  env,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import {
  clearSpotModeration,
  MAX_OPEN_REPORTS_PER_SPOT,
  spotModerationFor,
} from "./moderationModel";
import { releasePhotos, scheduleSpotDeletion } from "./spots";

const CLERK_API_ORIGIN = "https://api.clerk.com";
const APPLE_AUTH_ORIGIN = "https://appleid.apple.com";
const APPLE_CLIENT_ID = "com.yycskatespots.app";
const DELETE_BATCH_SIZE = 100;
const UPLOAD_DELETE_BATCH_SIZE = 20;
const MAX_CLEANUP_BATCHES_PER_REQUEST = 1_000;
const REQUEST_EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;

type AppleTokenType = "access_token" | "refresh_token";
type ClerkExternalAccount = { provider: string; providerUserId: string };
type ClerkUser = { externalAccounts: ClerkExternalAccount[] };
type DeleteAccountResult =
  | { status: "appleAuthorizationRequired"; appleUserId: string }
  | { status: "complete" };

function requiredEnvironmentValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Account deletion is unavailable because ${name} is not configured.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClerkUser(value: unknown): ClerkUser {
  if (!isRecord(value)) {
    throw new Error("Clerk returned an invalid user response.");
  }
  const rawAccounts = value.external_accounts ?? value.externalAccounts;
  if (!Array.isArray(rawAccounts)) {
    throw new Error("Clerk returned an invalid user response.");
  }
  const externalAccounts = rawAccounts.map((account) => {
    if (!isRecord(account)) {
      throw new Error("Clerk returned an invalid external account response.");
    }
    const provider = account.provider;
    const providerUserId = account.provider_user_id ?? account.providerUserId;
    if (typeof provider !== "string" || typeof providerUserId !== "string") {
      throw new Error("Clerk returned an invalid external account response.");
    }
    return { provider, providerUserId };
  });
  return { externalAccounts };
}

function clerkHeaders() {
  return {
    Authorization: `Bearer ${requiredEnvironmentValue("CLERK_SECRET_KEY", env.CLERK_SECRET_KEY)}`,
  };
}

async function fetchClerkUser(clerkUserId: string): Promise<ClerkUser | null> {
  const response = await fetch(`${CLERK_API_ORIGIN}/v1/users/${encodeURIComponent(clerkUserId)}`, {
    headers: clerkHeaders(),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Clerk could not verify this account. Please try again.");
  }
  return parseClerkUser(await response.json());
}

async function deleteClerkUser(clerkUserId: string) {
  const response = await fetch(`${CLERK_API_ORIGIN}/v1/users/${encodeURIComponent(clerkUserId)}`, {
    method: "DELETE",
    headers: clerkHeaders(),
  });
  // A retry can arrive after Clerk completed an earlier request whose response
  // never reached the app. Treating 404 as success makes that case idempotent.
  if (!response.ok && response.status !== 404) {
    throw new Error("Clerk could not delete this account. Please try again.");
  }
}

async function createAppleClientSecret() {
  const teamId = requiredEnvironmentValue("APPLE_TEAM_ID", env.APPLE_TEAM_ID);
  const keyId = requiredEnvironmentValue("APPLE_SIGN_IN_KEY_ID", env.APPLE_SIGN_IN_KEY_ID);
  const privateKey = requiredEnvironmentValue(
    "APPLE_SIGN_IN_PRIVATE_KEY",
    env.APPLE_SIGN_IN_PRIVATE_KEY,
  ).replace(/\\n/g, "\n");
  const signingKey = await importPKCS8(privateKey, "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setAudience(APPLE_AUTH_ORIGIN)
    .setSubject(APPLE_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKey);
}

async function exchangeAppleAuthorizationCode(code: string, expectedAppleUserId: string) {
  const body = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    client_secret: await createAppleClientSecret(),
    code,
    grant_type: "authorization_code",
  });
  const response = await fetch(`${APPLE_AUTH_ORIGIN}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("Apple could not verify this account. Please try again.");
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.id_token !== "string") {
    throw new Error("Apple returned an invalid authorization response.");
  }
  let appleSubject: unknown;
  try {
    appleSubject = decodeJwt(payload.id_token).sub;
  } catch {
    throw new Error("Apple returned an invalid identity token.");
  }
  if (appleSubject !== expectedAppleUserId) {
    throw new Error("The Apple account did not match the signed-in account.");
  }
  if (typeof payload.refresh_token === "string") {
    return { token: payload.refresh_token, tokenType: "refresh_token" as const };
  }
  if (typeof payload.access_token === "string") {
    return { token: payload.access_token, tokenType: "access_token" as const };
  }
  throw new Error("Apple did not return a token that can be revoked.");
}

async function revokeAppleToken(token: string, tokenType: AppleTokenType) {
  const body = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    client_secret: await createAppleClientSecret(),
    token,
    token_type_hint: tokenType,
  });
  const response = await fetch(`${APPLE_AUTH_ORIGIN}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error("Apple could not revoke this account. Please try again.");
  }
}

/** Reads private recovery state only for the authenticated action orchestrating deletion. */
export const requestForUser = internalQuery({
  args: { userIdentifier: v.string(), clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", args.userIdentifier))
      .unique();
    if (request && request.clerkUserId !== args.clerkUserId) {
      throw new Error("The deletion request does not match the signed-in account.");
    }
    return request;
  },
});

/** Starts, or resumes, one retry-safe deletion request for a verified Clerk identity. */
export const beginRequest = internalMutation({
  args: { userIdentifier: v.string(), clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", args.userIdentifier))
      .unique();
    if (existing) {
      if (existing.clerkUserId !== args.clerkUserId) {
        throw new Error("The deletion request does not match the signed-in account.");
      }
      return existing._id;
    }
    const requestId = await ctx.db.insert("accountDeletionRequests", {
      ...args,
      requestedAt: Date.now(),
      appleRevoked: false,
    });
    // An abandoned confirmation must not retain an Apple token or identity
    // reference indefinitely. Successful requests remove this row immediately.
    await ctx.scheduler.runAfter(REQUEST_EXPIRY_MS, internal.accountDeletion.expireRequest, {
      requestId,
    });
    return requestId;
  },
});

/** Persists Apple's short-lived recovery token before attempting the network revocation. */
export const rememberAppleToken = internalMutation({
  args: {
    requestId: v.id("accountDeletionRequests"),
    token: v.string(),
    tokenType: v.union(v.literal("access_token"), v.literal("refresh_token")),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("accountDeletionRequests", args.requestId);
    if (!request || request.appleRevoked) {
      return null;
    }
    await ctx.db.patch("accountDeletionRequests", request._id, {
      appleToken: args.token,
      appleTokenType: args.tokenType,
    });
    return null;
  },
});

/** Records successful revocation and drops the token before any other cleanup begins. */
export const markAppleRevoked = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("accountDeletionRequests", args.requestId);
    if (request) {
      await ctx.db.patch("accountDeletionRequests", request._id, {
        appleRevoked: true,
        appleToken: undefined,
        appleTokenType: undefined,
      });
    }
    return null;
  },
});

async function repairModerationAfterReportRemoval(ctx: MutationCtx, spotId: Id<"spots">) {
  const moderation = await spotModerationFor(ctx, spotId);
  if (!moderation) {
    return;
  }
  const spot = await ctx.db.get("spots", spotId);
  if (!spot || spot.deletionRequested) {
    await ctx.db.delete("spotModeration", moderation._id);
    return;
  }
  const remainingReports = await ctx.db
    .query("spotReports")
    .withIndex("by_spotId", (q) => q.eq("spotId", spotId))
    .take(MAX_OPEN_REPORTS_PER_SPOT);
  if (remainingReports.length > 0) {
    await ctx.db.patch("spotModeration", moderation._id, {
      needsReview: true,
      attentionReason: "reported",
      openReportCount: remainingReports.length,
    });
    return;
  }
  if (spot.publicationStatus === "published") {
    await ctx.db.patch("spotModeration", moderation._id, {
      needsReview: false,
      openReportCount: 0,
    });
    return;
  }
  await ctx.db.patch("spotModeration", moderation._id, {
    needsReview: true,
    attentionReason: moderation.lastSubmittedAt === spot._creationTime ? "new" : "edited",
    openReportCount: 0,
  });
}

/** Removes one bounded slice of the departing user's data and identity references. */
export const cleanupBatch = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args): Promise<boolean> => {
    const request = await ctx.db.get("accountDeletionRequests", args.requestId);
    if (!request) {
      return true;
    }
    const userIdentifier = request.userIdentifier;

    const activeSpot = await ctx.db
      .query("spots")
      .withIndex("by_createdBy_and_deletionRequested", (q) =>
        q.eq("createdBy", userIdentifier).eq("deletionRequested", undefined),
      )
      .first();
    if (activeSpot) {
      await releasePhotos(ctx, activeSpot.photoIds);
      await clearSpotModeration(ctx, activeSpot._id);
      await scheduleSpotDeletion(ctx, activeSpot._id);
      return false;
    }

    const deletingSpot = await ctx.db
      .query("spots")
      .withIndex("by_createdBy_and_deletionRequested", (q) =>
        q.eq("createdBy", userIdentifier).eq("deletionRequested", true),
      )
      .first();
    if (deletingSpot) {
      const favorites = await ctx.db
        .query("favorites")
        .withIndex("by_spotId_and_userId", (q) => q.eq("spotId", deletingSpot._id))
        .take(DELETE_BATCH_SIZE);
      for (const favorite of favorites) {
        await ctx.db.delete("favorites", favorite._id);
      }
      if (favorites.length < DELETE_BATCH_SIZE) {
        await ctx.db.delete("spots", deletingSpot._id);
      }
      return false;
    }

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_userId", (q) => q.eq("userId", userIdentifier))
      .take(DELETE_BATCH_SIZE);
    if (favorites.length > 0) {
      for (const favorite of favorites) {
        await ctx.db.delete("favorites", favorite._id);
      }
      return false;
    }

    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", userIdentifier))
      .take(UPLOAD_DELETE_BATCH_SIZE);
    if (uploads.length > 0) {
      for (const upload of uploads) {
        await ctx.db.delete("uploads", upload._id);
        await ctx.storage.delete(upload.storageId);
      }
      return false;
    }

    const reports = await ctx.db
      .query("spotReports")
      .withIndex("by_reportedBy", (q) => q.eq("reportedBy", userIdentifier))
      .take(DELETE_BATCH_SIZE);
    if (reports.length > 0) {
      for (const report of reports) {
        await ctx.db.delete("spotReports", report._id);
        await repairModerationAfterReportRemoval(ctx, report.spotId);
      }
      return false;
    }

    const removalNotices = await ctx.db
      .query("spotRemovals")
      .withIndex("by_createdBy_and_spotCreationTime", (q) => q.eq("createdBy", userIdentifier))
      .take(DELETE_BATCH_SIZE);
    if (removalNotices.length > 0) {
      for (const notice of removalNotices) {
        await ctx.db.delete("spotRemovals", notice._id);
      }
      return false;
    }

    const reviews = await ctx.db
      .query("spotModeration")
      .withIndex("by_reviewedBy", (q) => q.eq("reviewedBy", userIdentifier))
      .take(DELETE_BATCH_SIZE);
    if (reviews.length > 0) {
      for (const review of reviews) {
        await ctx.db.patch("spotModeration", review._id, { reviewedBy: undefined });
      }
      return false;
    }

    const removals = await ctx.db
      .query("spotRemovals")
      .withIndex("by_removedBy", (q) => q.eq("removedBy", userIdentifier))
      .take(DELETE_BATCH_SIZE);
    if (removals.length > 0) {
      for (const removal of removals) {
        await ctx.db.patch("spotRemovals", removal._id, { removedBy: undefined });
      }
      return false;
    }

    const bans = await ctx.db
      .query("userModeration")
      .withIndex("by_bannedBy", (q) => q.eq("bannedBy", userIdentifier))
      .take(DELETE_BATCH_SIZE);
    if (bans.length > 0) {
      for (const ban of bans) {
        await ctx.db.patch("userModeration", ban._id, { bannedBy: undefined });
      }
      return false;
    }

    const acknowledgement = await ctx.db
      .query("communityAcknowledgements")
      .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", userIdentifier))
      .unique();
    if (acknowledgement) {
      await ctx.db.delete("communityAcknowledgements", acknowledgement._id);
      return false;
    }

    const moderation = await ctx.db
      .query("userModeration")
      .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", userIdentifier))
      .unique();
    if (moderation) {
      await ctx.db.delete("userModeration", moderation._id);
      return false;
    }

    return true;
  },
});

export const finishRequest = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("accountDeletionRequests", args.requestId);
    if (request) {
      await ctx.db.delete("accountDeletionRequests", request._id);
    }
    return null;
  },
});

/** Purges recovery state if a user abandons a failed or cancelled attempt. */
export const expireRequest = internalMutation({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("accountDeletionRequests", args.requestId);
    if (request && request.requestedAt + REQUEST_EXPIRY_MS <= Date.now()) {
      await ctx.db.delete("accountDeletionRequests", request._id);
    }
    return null;
  },
});

/** Coordinates external revocation and complete data cleanup for the caller only. */
export const deleteAccount = action({
  args: { appleAuthorizationCode: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DeleteAccountResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be signed in to delete your account.");
    }
    const userIdentifier = identity.tokenIdentifier;
    const clerkUserId = identity.subject;
    let request = await ctx.runQuery(internal.accountDeletion.requestForUser, {
      userIdentifier,
      clerkUserId,
    });
    const clerkUser = await fetchClerkUser(clerkUserId);
    const appleAccount = clerkUser?.externalAccounts.find(
      ({ provider }) => provider === "apple" || provider === "oauth_apple",
    );

    if (
      appleAccount &&
      !request?.appleRevoked &&
      !request?.appleToken &&
      !args.appleAuthorizationCode
    ) {
      return {
        status: "appleAuthorizationRequired",
        appleUserId: appleAccount.providerUserId,
      };
    }

    const requestId = await ctx.runMutation(internal.accountDeletion.beginRequest, {
      userIdentifier,
      clerkUserId,
    });
    request = await ctx.runQuery(internal.accountDeletion.requestForUser, {
      userIdentifier,
      clerkUserId,
    });
    if (!request) {
      throw new Error("Could not start account deletion. Please try again.");
    }

    if (!request.appleRevoked && appleAccount) {
      let token = request.appleToken;
      let tokenType = request.appleTokenType;
      if (!token || !tokenType) {
        if (!args.appleAuthorizationCode) {
          return {
            status: "appleAuthorizationRequired",
            appleUserId: appleAccount.providerUserId,
          };
        }
        const exchanged = await exchangeAppleAuthorizationCode(
          args.appleAuthorizationCode,
          appleAccount.providerUserId,
        );
        token = exchanged.token;
        tokenType = exchanged.tokenType;
        await ctx.runMutation(internal.accountDeletion.rememberAppleToken, {
          requestId,
          token,
          tokenType,
        });
      }
      await revokeAppleToken(token, tokenType);
      await ctx.runMutation(internal.accountDeletion.markAppleRevoked, { requestId });
    } else if (!request.appleRevoked && request.appleToken && request.appleTokenType) {
      // Clerk may have removed the external-account link after a partial
      // attempt; the stored Apple token still needs to be revoked.
      await revokeAppleToken(request.appleToken, request.appleTokenType);
      await ctx.runMutation(internal.accountDeletion.markAppleRevoked, { requestId });
    }

    let cleanupComplete = false;
    for (let batch = 0; batch < MAX_CLEANUP_BATCHES_PER_REQUEST; batch += 1) {
      cleanupComplete = await ctx.runMutation(internal.accountDeletion.cleanupBatch, {
        requestId,
      });
      if (cleanupComplete) {
        break;
      }
    }
    if (!cleanupComplete) {
      throw new Error("Account cleanup needs another attempt. Please try again.");
    }

    await deleteClerkUser(clerkUserId);
    await ctx.runMutation(internal.accountDeletion.finishRequest, { requestId });
    return { status: "complete" };
  },
});
