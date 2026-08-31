/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { MAX_SPOTS_LISTED } from "./spots";

const modules = import.meta.glob("./**/*.ts");

const SPOT = {
  name: "Test Ledge",
  types: ["ledge" as const],
  bustFactor: "low" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};

describe("spot moderation", () => {
  test("new and edited spots enter the private review queue", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice", name: "Alice" });
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
    const id = await asAlice.mutation(api.spots.create, SPOT);

    await expect(asAlice.query(api.moderation.listSpots, {})).rejects.toThrow(/Administrator/);
    await expect(
      asAlice.mutation(api.moderation.removeSpot, { spotId: id, reason: "other" }),
    ).rejects.toThrow(/Administrator/);
    const [created] = await asAdmin.query(api.moderation.listSpots, {});
    expect(created).toMatchObject({
      _id: id,
      creatorName: "Alice",
      review: { needsReview: true, attentionReason: "new", openReportCount: 0 },
    });

    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    expect((await asAdmin.query(api.moderation.listSpots, {}))[0].review.needsReview).toBe(false);

    await asAlice.mutation(api.spots.update, { ...SPOT, id, notes: "Fresh details" });
    expect((await asAdmin.query(api.moderation.listSpots, {}))[0].review).toMatchObject({
      needsReview: true,
      attentionReason: "edited",
      openReportCount: 0,
    });
  });

  test("legacy spots without review rows appear as unreviewed, newest first", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
    const olderId = await t.run((ctx) =>
      ctx.db.insert("spots", { ...SPOT, name: "Older", createdBy: "legacy" }),
    );
    const newerId = await t.run((ctx) =>
      ctx.db.insert("spots", { ...SPOT, name: "Newer", createdBy: "legacy" }),
    );

    const queue = await asAdmin.query(api.moderation.listSpots, {});
    expect(queue.map((spot) => spot._id)).toEqual([newerId, olderId]);
    expect(queue.every((spot) => spot.review.needsReview)).toBe(true);
    expect(queue.every((spot) => spot.review.attentionReason === "new")).toBe(true);
  });

  test("queue cap and metadata remain correlated after moderation tables exceed the limit", async () => {
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
    const targetId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("spots", {
        ...SPOT,
        createdBy: "target-owner",
        createdByName: "Target Owner",
      });
      for (let index = 0; index < MAX_SPOTS_LISTED; index += 1) {
        const staleSpotId = await ctx.db.insert("spots", {
          ...SPOT,
          name: `Pending deletion ${index}`,
          createdBy: `stale-user-${index}`,
          deletionRequested: true,
        });
        await ctx.db.insert("spotModeration", {
          spotId: staleSpotId,
          spotCreationTime: index,
          needsReview: false,
          attentionReason: "new",
          lastSubmittedAt: index,
          openReportCount: 0,
        });
        await ctx.db.insert("userModeration", {
          userIdentifier: `stale-user-${index}`,
          confirmedRemovalCount: 0,
          isBanned: false,
        });
      }

      await ctx.db.insert("spotModeration", {
        spotId: id,
        spotCreationTime: Date.now(),
        needsReview: true,
        attentionReason: "reported",
        lastSubmittedAt: Date.now(),
        openReportCount: 2,
      });
      await ctx.db.insert("userModeration", {
        userIdentifier: "target-owner",
        name: "Target Owner",
        confirmedRemovalCount: 3,
        isBanned: true,
      });
      return id;
    });

    const target = (await asAdmin.query(api.moderation.listSpots, {})).find(
      (spot) => spot._id === targetId,
    );
    expect(target).toMatchObject({
      creatorRemovalCount: 3,
      creatorIsBanned: true,
      review: { needsReview: true, attentionReason: "reported", openReportCount: 2 },
    });
  });

  test("reports are private, unique per reporter, and return a spot to review", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
    const id = await asAlice.mutation(api.spots.create, SPOT);

    await expect(
      asAlice.mutation(api.reports.create, { spotId: id, reason: "not_a_spot" }),
    ).rejects.toThrow(/own spot/);
    await expect(
      t.mutation(api.reports.create, { spotId: id, reason: "not_a_spot" }),
    ).rejects.toThrow(/signed in/);

    await asBob.mutation(api.reports.create, {
      spotId: id,
      reason: "duplicate_or_inaccurate",
      details: "  Wrong location  ",
    });
    await expect(
      asBob.mutation(api.reports.create, { spotId: id, reason: "other" }),
    ).rejects.toThrow(/already reported/);

    const review = await asAdmin.query(api.moderation.getSpot, { id });
    expect(review?.review).toMatchObject({
      needsReview: true,
      attentionReason: "reported",
      openReportCount: 1,
    });
    expect(review?.reports).toMatchObject([
      { reason: "duplicate_or_inaccurate", details: "Wrong location" },
    ]);
    expect(review?.reports[0]).not.toHaveProperty("reportedBy");

    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    expect((await asAdmin.query(api.moderation.getSpot, { id }))?.reports).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("spotReports").take(10))).toEqual([]);
  });

  test("admin removal leaves an owner-only notice and records one strike", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice", name: "Alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
    const photoId = await t.run((ctx) => ctx.storage.store(new Blob(["photo"])));
    await asAlice.mutation(internal.spots.recordUpload, { storageId: photoId });
    const id = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [photoId] });
    await asBob.mutation(api.favorites.toggle, { spotId: id });
    await asBob.mutation(api.reports.create, { spotId: id, reason: "not_a_spot" });

    const result = await asAdmin.mutation(api.moderation.removeSpot, {
      spotId: id,
      reason: "not_a_spot",
    });
    expect(result).toMatchObject({ strikeCount: 1, eligibleForBan: false });
    expect(await t.query(api.spots.get, { id })).toBeNull();
    expect(await asBob.query(api.spots.get, { id })).toBeNull();
    expect(await asAlice.query(api.spots.get, { id })).toMatchObject({
      status: "removed",
      name: SPOT.name,
      reason: "not_a_spot",
      strikeNumber: 1,
    });
    expect(await asAlice.query(api.spots.mine, {})).toMatchObject([
      { status: "removed", _id: id, strikeNumber: 1 },
    ]);
    expect(await t.query(api.spots.list, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.storage.getUrl(photoId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("spotReports").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("spotModeration").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("favorites").take(10))).toHaveLength(1);
    await t.mutation(internal.spots.removeFavoriteBatch, { spotId: id });
    expect(await t.run((ctx) => ctx.db.get("spots", id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("favorites").take(10))).toEqual([]);
  });

  test("three removals make a contributor eligible for a manual, reversible ban", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice", name: "Alice" });
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
    const ids = await Promise.all(
      ["One", "Two", "Three", "Kept"].map((name) =>
        asAlice.mutation(api.spots.create, { ...SPOT, name }),
      ),
    );

    const first = await asAdmin.mutation(api.moderation.removeSpot, {
      spotId: ids[0],
      reason: "spam_or_abuse",
    });
    if (!first.contributorModerationId) throw new Error("Expected contributor moderation.");
    await expect(
      asAdmin.mutation(api.moderation.banContributor, {
        moderationUserId: first.contributorModerationId,
      }),
    ).rejects.toThrow(/Three confirmed removals/);

    await asAdmin.mutation(api.moderation.removeSpot, {
      spotId: ids[1],
      reason: "spam_or_abuse",
    });
    const third = await asAdmin.mutation(api.moderation.removeSpot, {
      spotId: ids[2],
      reason: "spam_or_abuse",
    });
    expect(third).toMatchObject({ strikeCount: 3, eligibleForBan: true });

    expect(await asAdmin.query(api.moderation.listEligibleContributors, {})).toEqual([
      {
        _id: first.contributorModerationId,
        name: "Alice",
        confirmedRemovalCount: 3,
      },
    ]);
    await asAdmin.mutation(api.moderation.banContributor, {
      moderationUserId: first.contributorModerationId,
    });
    expect(await asAlice.query(api.moderation.viewer, {})).toMatchObject({
      isBanned: true,
      confirmedRemovalCount: 3,
    });
    await expect(asAlice.mutation(api.spots.create, SPOT)).rejects.toThrow(/access/);
    await expect(
      asAlice.mutation(api.spots.update, { ...SPOT, id: ids[3], name: "Changed" }),
    ).rejects.toThrow(/access/);
    const blockedUpload = await t.run((ctx) => ctx.storage.store(new Blob(["blocked"])));
    await expect(
      asAlice.mutation(internal.spots.recordUpload, { storageId: blockedUpload }),
    ).rejects.toThrow(/access/);
    expect(await t.run((ctx) => ctx.db.query("uploads").take(10))).toEqual([]);

    // A ban blocks new contributions, not cleanup of an existing spot.
    await asAlice.mutation(api.spots.remove, { id: ids[3] });
    await asAdmin.mutation(api.moderation.unbanContributor, {
      moderationUserId: first.contributorModerationId,
    });
    expect((await asAlice.query(api.moderation.viewer, {})).isBanned).toBe(false);
    await expect(asAlice.mutation(api.spots.create, SPOT)).resolves.toBeDefined();
  });

  test("owner deletion clears reports without a removal notice or strike", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const id = await asAlice.mutation(api.spots.create, SPOT);
    await asBob.mutation(api.reports.create, { spotId: id, reason: "other" });

    await asAlice.mutation(api.spots.remove, { id });
    expect(await asAlice.query(api.spots.get, { id })).toBeNull();
    expect(await asAlice.query(api.spots.mine, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("spotReports").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("spotRemovals").take(10))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("userModeration").take(10))).toEqual([]);
  });
});
