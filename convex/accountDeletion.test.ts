/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgquAJhBqv/6oYy8mc
gE5UwGYrvyQaVk7f+Uw5xjoXRQuhRANCAAR7D/JlRA4rLwyDs+CFq6cix8bFVZwa
XxCDOxSl0PwnGIcu3ThZNpT3oo7dyaKPs4s7qSFz3wqFuO96IFxK0Hwo
-----END PRIVATE KEY-----`;
const APPLE_ID_TOKEN = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhcHBsZS11c2VyIn0.";
const USER_IDENTIFIER = "https://clerk.example.test|user_alice";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeAll(() => {
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_not-a-secret");
  vi.stubEnv("APPLE_TEAM_ID", "TESTTEAM01");
  vi.stubEnv("APPLE_SIGN_IN_KEY_ID", "TESTKEY001");
  vi.stubEnv("APPLE_SIGN_IN_PRIVATE_KEY", TEST_PRIVATE_KEY);
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("account deletion", () => {
  test("requires a verified Clerk identity before doing any work", async () => {
    const t = convexTest(schema, modules);

    await expect(t.action(api.accountDeletion.deleteAccount, {})).rejects.toThrow(/signed in/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("removes owned data and scrubs identity references before deleting Clerk", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({
      subject: "user_alice",
      tokenIdentifier: USER_IDENTIFIER,
    });
    const ids = await t.run(async (ctx) => {
      const ownedPhoto = await ctx.storage.store(new Blob(["owned photo"]));
      const pendingUpload = await ctx.storage.store(new Blob(["pending upload"]));
      const ownedSpot = await ctx.db.insert("spots", {
        name: "Alice's spot",
        types: ["ledge"],
        bustFactor: "medium",
        latitude: 51,
        longitude: -114,
        photoIds: [ownedPhoto],
        createdBy: USER_IDENTIFIER,
        createdByName: "Alice",
        publicationStatus: "published",
      });
      await ctx.db.insert("spotPhotos", { storageId: ownedPhoto, spotId: ownedSpot });
      await ctx.db.insert("spotModeration", {
        spotId: ownedSpot,
        spotCreationTime: Date.now(),
        needsReview: true,
        attentionReason: "reported",
        lastSubmittedAt: Date.now(),
        openReportCount: 1,
      });
      await ctx.db.insert("spotReports", {
        spotId: ownedSpot,
        reportedBy: "other-user",
        reason: "other",
      });
      await ctx.db.insert("favorites", { userId: "other-user", spotId: ownedSpot });

      const otherSpot = await ctx.db.insert("spots", {
        name: "Someone else's spot",
        types: ["curb"],
        bustFactor: "low",
        latitude: 51,
        longitude: -114,
        photoIds: [],
        createdBy: "other-user",
        publicationStatus: "published",
      });
      const otherReview = await ctx.db.insert("spotModeration", {
        spotId: otherSpot,
        spotCreationTime: Date.now(),
        needsReview: true,
        attentionReason: "reported",
        lastSubmittedAt: Date.now(),
        openReportCount: 1,
        reviewedBy: USER_IDENTIFIER,
      });
      await ctx.db.insert("spotReports", {
        spotId: otherSpot,
        reportedBy: USER_IDENTIFIER,
        reason: "spam_or_abuse",
      });
      await ctx.db.insert("favorites", { userId: USER_IDENTIFIER, spotId: otherSpot });
      await ctx.db.insert("uploads", {
        storageId: pendingUpload,
        uploadedBy: USER_IDENTIFIER,
      });
      await ctx.db.insert("spotRemovals", {
        spotId: ownedSpot,
        spotCreationTime: Date.now(),
        name: "Old Alice spot",
        createdBy: USER_IDENTIFIER,
        reason: "other",
        removedAt: Date.now(),
        removedBy: "other-admin",
        reportCount: 1,
        strikeNumber: 1,
      });
      const otherRemoval = await ctx.db.insert("spotRemovals", {
        spotId: otherSpot,
        spotCreationTime: Date.now(),
        name: "Old other spot",
        createdBy: "other-user",
        reason: "other",
        removedAt: Date.now(),
        removedBy: USER_IDENTIFIER,
        reportCount: 1,
        strikeNumber: 1,
      });
      await ctx.db.insert("userModeration", {
        userIdentifier: USER_IDENTIFIER,
        name: "Alice",
        confirmedRemovalCount: 1,
        isBanned: false,
      });
      const otherModeration = await ctx.db.insert("userModeration", {
        userIdentifier: "other-user",
        confirmedRemovalCount: 3,
        isBanned: true,
        bannedBy: USER_IDENTIFIER,
      });
      await ctx.db.insert("communityAcknowledgements", {
        userIdentifier: USER_IDENTIFIER,
        standardsVersion: 1,
        acceptedAt: Date.now(),
      });
      return {
        ownedPhoto,
        pendingUpload,
        ownedSpot,
        otherSpot,
        otherReview,
        otherRemoval,
        otherModeration,
      };
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ external_accounts: [] }))
      .mockResolvedValueOnce(jsonResponse({ object: "user", deleted: true }));

    await expect(asAlice.action(api.accountDeletion.deleteAccount, {})).resolves.toEqual({
      status: "complete",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("spots", ids.ownedSpot)).toBeNull();
      expect(await ctx.db.get("spots", ids.otherSpot)).not.toBeNull();
      expect(await ctx.storage.getUrl(ids.ownedPhoto)).toBeNull();
      expect(await ctx.storage.getUrl(ids.pendingUpload)).toBeNull();
      expect(await ctx.db.query("favorites").collect()).toEqual([]);
      expect(await ctx.db.query("spotPhotos").collect()).toEqual([]);
      expect(await ctx.db.query("uploads").collect()).toEqual([]);
      expect(await ctx.db.query("spotReports").collect()).toEqual([]);
      expect(await ctx.db.query("communityAcknowledgements").collect()).toEqual([]);
      expect(await ctx.db.query("accountDeletionRequests").collect()).toEqual([]);
      expect(await ctx.db.get("spotModeration", ids.otherReview)).toMatchObject({
        needsReview: false,
        openReportCount: 0,
      });
      expect(await ctx.db.get("spotModeration", ids.otherReview)).not.toHaveProperty("reviewedBy");
      expect(await ctx.db.get("spotRemovals", ids.otherRemoval)).not.toHaveProperty("removedBy");
      expect(await ctx.db.get("userModeration", ids.otherModeration)).not.toHaveProperty(
        "bannedBy",
      );
      expect(await ctx.db.query("userModeration").collect()).toHaveLength(1);
      expect(await ctx.db.query("spotRemovals").collect()).toHaveLength(1);
    });
  });

  test("requests Apple authorization and revokes the matching Apple token", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({
      subject: "user_alice",
      tokenIdentifier: USER_IDENTIFIER,
    });
    const clerkUser = {
      external_accounts: [
        { provider: "apple", provider_user_id: "apple-user" },
        { provider: "google", provider_user_id: "google-user" },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clerkUser))
      .mockResolvedValueOnce(jsonResponse(clerkUser))
      .mockResolvedValueOnce(
        jsonResponse({
          id_token: APPLE_ID_TOKEN,
          refresh_token: "apple-refresh-token",
          access_token: "apple-access-token",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ object: "user", deleted: true }));

    await expect(asAlice.action(api.accountDeletion.deleteAccount, {})).resolves.toEqual({
      status: "appleAuthorizationRequired",
      appleUserId: "apple-user",
    });
    expect(await t.run((ctx) => ctx.db.query("accountDeletionRequests").collect())).toEqual([]);
    await expect(
      asAlice.action(api.accountDeletion.deleteAccount, {
        appleAuthorizationCode: "fresh-authorization-code",
      }),
    ).resolves.toEqual({ status: "complete" });

    const tokenCall = fetchMock.mock.calls[2];
    expect(tokenCall?.[0]).toBe("https://appleid.apple.com/auth/token");
    expect(tokenCall?.[1]?.body).toBeInstanceOf(URLSearchParams);
    expect((tokenCall?.[1]?.body as URLSearchParams).get("code")).toBe("fresh-authorization-code");
    const revokeCall = fetchMock.mock.calls[3];
    expect(revokeCall?.[0]).toBe("https://appleid.apple.com/auth/revoke");
    expect((revokeCall?.[1]?.body as URLSearchParams).get("token")).toBe("apple-refresh-token");
    expect((revokeCall?.[1]?.body as URLSearchParams).get("token_type_hint")).toBe("refresh_token");
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ method: "DELETE" });
  });

  test("resumes after Clerk fails without asking Apple to revoke twice", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({
      subject: "user_alice",
      tokenIdentifier: USER_IDENTIFIER,
    });
    const clerkUser = {
      external_accounts: [{ provider: "apple", provider_user_id: "apple-user" }],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clerkUser))
      .mockResolvedValueOnce(
        jsonResponse({ id_token: APPLE_ID_TOKEN, refresh_token: "apple-refresh-token" }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse(clerkUser))
      .mockResolvedValueOnce(jsonResponse({ object: "user", deleted: true }));

    await expect(
      asAlice.action(api.accountDeletion.deleteAccount, {
        appleAuthorizationCode: "fresh-authorization-code",
      }),
    ).rejects.toThrow(/Clerk could not delete/);
    expect(
      await t.run(async (ctx) => {
        const request = await ctx.db.query("accountDeletionRequests").unique();
        return (
          request && {
            appleRevoked: request.appleRevoked,
            hasStoredToken: request.appleToken !== undefined,
          }
        );
      }),
    ).toEqual({ appleRevoked: true, hasStoredToken: false });

    await expect(asAlice.action(api.accountDeletion.deleteAccount, {})).resolves.toEqual({
      status: "complete",
    });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/token")),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/revoke")),
    ).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("accountDeletionRequests").collect())).toEqual([]);
  });

  test("retains Apple's token only long enough to retry a failed revocation", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({
      subject: "user_alice",
      tokenIdentifier: USER_IDENTIFIER,
    });
    const clerkUser = {
      external_accounts: [{ provider: "apple", provider_user_id: "apple-user" }],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clerkUser))
      .mockResolvedValueOnce(
        jsonResponse({ id_token: APPLE_ID_TOKEN, refresh_token: "apple-refresh-token" }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse(clerkUser))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ object: "user", deleted: true }));

    await expect(
      asAlice.action(api.accountDeletion.deleteAccount, {
        appleAuthorizationCode: "fresh-authorization-code",
      }),
    ).rejects.toThrow(/Apple could not revoke/);
    expect(
      await t.run(async (ctx) => {
        const request = await ctx.db.query("accountDeletionRequests").unique();
        return (
          request && {
            appleRevoked: request.appleRevoked,
            appleToken: request.appleToken,
          }
        );
      }),
    ).toEqual({ appleRevoked: false, appleToken: "apple-refresh-token" });

    await expect(asAlice.action(api.accountDeletion.deleteAccount, {})).resolves.toEqual({
      status: "complete",
    });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/token")),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/revoke")),
    ).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("accountDeletionRequests").collect())).toEqual([]);
  });
});
