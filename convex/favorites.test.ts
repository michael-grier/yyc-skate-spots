/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_FAVORITES_LISTED } from "./favorites";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Harness = ReturnType<typeof convexTest>;
type Identity = ReturnType<Harness["withIdentity"]>;

async function finishScheduled(t: Harness) {
  vi.useFakeTimers();
  try {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
}

const SPOT = {
  name: "Test Ledge",
  types: ["ledge" as const],
  bustFactor: "medium" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};

async function createPublishedSpot(t: Harness, as: Identity, spot: typeof SPOT) {
  await as.mutation(api.moderation.acknowledgeStandards, {});
  const spotId = await as.mutation(api.spots.create, spot);
  const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
  await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId });
  return spotId;
}

describe("favorites", () => {
  test("pending spots cannot be saved or exposed through an existing favorite", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob", tokenIdentifier: "test|bob" });
    await asAlice.mutation(api.moderation.acknowledgeStandards, {});
    const spotId = await asAlice.mutation(api.spots.create, SPOT);

    await expect(asBob.mutation(api.favorites.toggle, { spotId })).rejects.toThrow(/not found/);
    await t.run((ctx) => ctx.db.insert("favorites", { userId: "test|bob", spotId }));
    expect(await asBob.query(api.favorites.list, {})).toEqual([]);
  });

  test("fills the visible limit after skipping newer pending favorites", async () => {
    const t = convexTest(schema, modules);
    const userId = "test|bob";
    const visibleId = await t.run(async (ctx) => {
      const visibleSpotId = await ctx.db.insert("spots", {
        ...SPOT,
        createdBy: "seed",
        publicationStatus: "published",
      });
      await ctx.db.insert("favorites", { userId, spotId: visibleSpotId });
      for (let index = 0; index < MAX_FAVORITES_LISTED; index += 1) {
        const pendingSpotId = await ctx.db.insert("spots", {
          ...SPOT,
          name: `Pending ${index}`,
          createdBy: "seed",
          publicationStatus: "pending",
        });
        await ctx.db.insert("favorites", { userId, spotId: pendingSpotId });
      }
      return visibleSpotId;
    });

    const asBob = t.withIdentity({ subject: "bob", tokenIdentifier: userId });
    expect((await asBob.query(api.favorites.list, {})).map((spot) => spot._id)).toEqual([
      visibleId,
    ]);
  });

  test("browsing the list is private and writing requires sign-in", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const spotId = await createPublishedSpot(t, asAlice, SPOT);

    expect(await t.query(api.favorites.list, {})).toEqual([]);
    await expect(t.mutation(api.favorites.toggle, { spotId })).rejects.toThrow(/signed in/);
  });

  test("toggle saves and unsaves one spot for only the caller", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const spotId = await createPublishedSpot(t, asAlice, SPOT);

    expect(await asBob.mutation(api.favorites.toggle, { spotId })).toBe(true);
    expect((await asBob.query(api.favorites.list, {})).map((spot) => spot.name)).toEqual([
      "Test Ledge",
    ]);
    const seenByBob = await asBob.query(api.spots.get, { id: spotId });
    const seenByAlice = await asAlice.query(api.spots.get, { id: spotId });
    const seenAnonymously = await t.query(api.spots.get, { id: spotId });
    expect(seenByBob?.status).toBe("active");
    expect(seenByAlice?.status).toBe("active");
    expect(seenAnonymously?.status).toBe("active");
    if (
      seenByBob?.status !== "active" ||
      seenByAlice?.status !== "active" ||
      seenAnonymously?.status !== "active"
    ) {
      throw new Error("Expected active spots.");
    }
    expect(seenByBob.isFavorite).toBe(true);
    expect(seenByAlice.isFavorite).toBe(false);
    expect(seenAnonymously.isFavorite).toBe(false);

    expect(await asBob.mutation(api.favorites.toggle, { spotId })).toBe(false);
    expect(await asBob.query(api.favorites.list, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("favorites").collect())).toEqual([]);
  });

  test("lists the most recently saved spot first and allows saving your own spot", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const first = await createPublishedSpot(t, asAlice, { ...SPOT, name: "First" });
    const second = await createPublishedSpot(t, asAlice, { ...SPOT, name: "Second" });

    await asAlice.mutation(api.favorites.toggle, { spotId: first });
    await asAlice.mutation(api.favorites.toggle, { spotId: second });

    expect((await asAlice.query(api.favorites.list, {})).map((spot) => spot.name)).toEqual([
      "Second",
      "First",
    ]);
  });

  test("a deleted spot cannot be saved", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const spotId = await createPublishedSpot(t, asAlice, SPOT);
    await asAlice.mutation(api.spots.remove, { id: spotId });

    await expect(asAlice.mutation(api.favorites.toggle, { spotId })).rejects.toThrow(/not found/);
  });

  test("spot deletion removes every user's rows and leaves other favourites alone", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const asCara = t.withIdentity({ subject: "cara" });
    const removed = await createPublishedSpot(t, asAlice, { ...SPOT, name: "Removed" });
    const kept = await createPublishedSpot(t, asAlice, { ...SPOT, name: "Kept" });

    await asAlice.mutation(api.favorites.toggle, { spotId: removed });
    await asBob.mutation(api.favorites.toggle, { spotId: removed });
    await asCara.mutation(api.favorites.toggle, { spotId: removed });
    await asBob.mutation(api.favorites.toggle, { spotId: kept });
    await asAlice.mutation(api.spots.remove, { id: removed });

    // The soft-deleted spot disappears from reads before physical cleanup.
    expect((await asBob.query(api.favorites.list, {})).map((spot) => spot.name)).toEqual(["Kept"]);
    expect(await asAlice.query(api.favorites.list, {})).toEqual([]);
    expect(await asCara.query(api.favorites.list, {})).toEqual([]);
    await finishScheduled(t);
    expect(await t.run((ctx) => ctx.db.query("favorites").collect())).toMatchObject([
      { spotId: kept },
    ]);
  });

  test("spot deletion batches more favourite rows than one worker can remove", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const asAlice = t.withIdentity({ subject: "alice" });
    const spotId = await createPublishedSpot(t, asAlice, SPOT);
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i += 1) {
        await ctx.db.insert("favorites", { userId: `user-${i}`, spotId });
      }
    });

    vi.useFakeTimers();
    try {
      await asAlice.mutation(api.spots.remove, { id: spotId });
      expect(await t.query(api.spots.get, { id: spotId })).toBeNull();
      expect(await t.run((ctx) => ctx.db.query("favorites").collect())).toHaveLength(101);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }
    expect(await t.run((ctx) => ctx.db.get("spots", spotId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("favorites").collect())).toEqual([]);
  });
});
