/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SPOT = {
  name: "Test Ledge",
  types: ["ledge" as const],
  bustFactor: "medium" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};

describe("favorites", () => {
  test("browsing the list is private and writing requires sign-in", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const spotId = await asAlice.mutation(api.spots.create, SPOT);

    expect(await t.query(api.favorites.list, {})).toEqual([]);
    await expect(t.mutation(api.favorites.toggle, { spotId })).rejects.toThrow(/signed in/);
  });

  test("toggle saves and unsaves one spot for only the caller", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const spotId = await asAlice.mutation(api.spots.create, SPOT);

    expect(await asBob.mutation(api.favorites.toggle, { spotId })).toBe(true);
    expect((await asBob.query(api.favorites.list, {})).map((spot) => spot.name)).toEqual([
      "Test Ledge",
    ]);
    expect((await asBob.query(api.spots.get, { id: spotId }))?.isFavorite).toBe(true);
    expect((await asAlice.query(api.spots.get, { id: spotId }))?.isFavorite).toBe(false);
    expect((await t.query(api.spots.get, { id: spotId }))?.isFavorite).toBe(false);

    expect(await asBob.mutation(api.favorites.toggle, { spotId })).toBe(false);
    expect(await asBob.query(api.favorites.list, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("favorites").collect())).toEqual([]);
  });

  test("lists the most recently saved spot first and allows saving your own spot", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const first = await asAlice.mutation(api.spots.create, { ...SPOT, name: "First" });
    const second = await asAlice.mutation(api.spots.create, { ...SPOT, name: "Second" });

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
    const spotId = await asAlice.mutation(api.spots.create, SPOT);
    await asAlice.mutation(api.spots.remove, { id: spotId });

    await expect(asAlice.mutation(api.favorites.toggle, { spotId })).rejects.toThrow(/not found/);
  });

  test("spot deletion removes every user's rows and leaves other favourites alone", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const asCara = t.withIdentity({ subject: "cara" });
    const removed = await asAlice.mutation(api.spots.create, { ...SPOT, name: "Removed" });
    const kept = await asAlice.mutation(api.spots.create, { ...SPOT, name: "Kept" });

    await asAlice.mutation(api.favorites.toggle, { spotId: removed });
    await asBob.mutation(api.favorites.toggle, { spotId: removed });
    await asCara.mutation(api.favorites.toggle, { spotId: removed });
    await asBob.mutation(api.favorites.toggle, { spotId: kept });
    await asAlice.mutation(api.spots.remove, { id: removed });

    expect((await asBob.query(api.favorites.list, {})).map((spot) => spot.name)).toEqual(["Kept"]);
    expect(await asAlice.query(api.favorites.list, {})).toEqual([]);
    expect(await asCara.query(api.favorites.list, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("favorites").collect())).toMatchObject([
      { spotId: kept },
    ]);
  });
});
