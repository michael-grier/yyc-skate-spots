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
  bustFactor: "high" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};

describe("spots authz", () => {
  test("browsing is public but writing requires sign-in", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.spots.create, SPOT)).rejects.toThrow(/signed in/);
    expect(await t.query(api.spots.list, {})).toEqual([]);
  });

  test("creator can update and delete their spot", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice", name: "Alice" });

    const id = await asAlice.mutation(api.spots.create, SPOT);
    await asAlice.mutation(api.spots.update, { ...SPOT, id, bustFactor: "low" });
    const updated = await t.query(api.spots.get, { id });
    expect(updated?.bustFactor).toBe("low");
    expect(updated?.createdByName).toBe("Alice");

    await asAlice.mutation(api.spots.remove, { id });
    expect(await t.query(api.spots.get, { id })).toBeNull();
  });

  test("update clears optional fields that are omitted", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const id = await asAlice.mutation(api.spots.create, {
      ...SPOT,
      notes: "Go early.",
      surface: "rough",
    });
    await asAlice.mutation(api.spots.update, { ...SPOT, id });
    const spot = await t.query(api.spots.get, { id });
    expect(spot?.notes).toBeUndefined();
    expect(spot?.surface).toBeUndefined();
    expect(spot?.createdByName).toBeUndefined();
  });

  test("a different user cannot update or delete someone else's spot", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });

    const id = await asAlice.mutation(api.spots.create, SPOT);
    await expect(asBob.mutation(api.spots.update, { ...SPOT, id, name: "Stolen" })).rejects.toThrow(
      /Only the person/,
    );
    await expect(asBob.mutation(api.spots.remove, { id })).rejects.toThrow(/Only the person/);

    // Untouched after both rejected writes.
    const spot = await t.query(api.spots.get, { id });
    expect(spot?.name).toBe("Test Ledge");
  });

  test("field limits and coordinate bounds are enforced", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });

    await expect(asAlice.mutation(api.spots.create, { ...SPOT, name: "  " })).rejects.toThrow(
      /Name/,
    );
    await expect(
      asAlice.mutation(api.spots.create, { ...SPOT, notes: "x".repeat(2001) }),
    ).rejects.toThrow(/Notes/);
    await expect(asAlice.mutation(api.spots.create, { ...SPOT, types: [] })).rejects.toThrow(
      /at least one/,
    );
    await expect(
      asAlice.mutation(api.spots.create, { ...SPOT, types: ["ledge", "ledge"] }),
    ).rejects.toThrow(/at most once/);
    await expect(asAlice.mutation(api.spots.create, { ...SPOT, latitude: 91 })).rejects.toThrow(
      /Latitude/,
    );
    await expect(asAlice.mutation(api.spots.create, { ...SPOT, longitude: -181 })).rejects.toThrow(
      /Longitude/,
    );
  });

  test("photo storage ids are never exposed to non-owners", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const photoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["jpeg bytes"])));

    const id = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [photoId] });

    const anonymous = await t.query(api.spots.get, { id });
    expect(anonymous?.isOwner).toBe(false);
    expect(anonymous?.photoIds).toBeNull();
    expect(anonymous).not.toHaveProperty("createdBy");
    expect((await t.query(api.spots.list, {}))[0]).not.toHaveProperty("photoIds");

    const asOwner = await asAlice.query(api.spots.get, { id });
    expect(asOwner?.isOwner).toBe(true);
    expect(asOwner?.photoIds).toEqual([photoId]);
  });

  test("a photo attached to one spot cannot be attached to another", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const photoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["jpeg bytes"])));

    const alicesSpot = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [photoId] });

    // Bob attaching Alice's photo would let him destroy the file later by
    // deleting his own spot.
    await expect(
      asBob.mutation(api.spots.create, { ...SPOT, name: "Bob's", photoIds: [photoId] }),
    ).rejects.toThrow(/another spot/);

    const bobsSpot = await asBob.mutation(api.spots.create, { ...SPOT, name: "Bob's" });
    await expect(
      asBob.mutation(api.spots.update, { ...SPOT, id: bobsSpot, photoIds: [photoId] }),
    ).rejects.toThrow(/another spot/);

    // Alice's file is still there.
    const spot = await t.query(api.spots.get, { id: alicesSpot });
    expect(spot?.photoUrls).toHaveLength(1);
  });

  test("get returns null for a malformed id instead of throwing", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.spots.get, { id: "not-a-real-id" })).toBeNull();
  });

  test("discardUpload removes stray uploads but never an attached photo", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const [stray, attached] = await t.run(async (ctx) => [
      await ctx.storage.store(new Blob(["stray"])),
      await ctx.storage.store(new Blob(["attached"])),
    ]);
    await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [attached] });

    await expect(t.mutation(api.spots.discardUpload, { storageId: stray })).rejects.toThrow(
      /signed in/,
    );
    await expect(asBob.mutation(api.spots.discardUpload, { storageId: attached })).rejects.toThrow(
      /belongs to a spot/,
    );
    expect(await t.run((ctx) => ctx.storage.getUrl(attached))).not.toBeNull();

    await asAlice.mutation(api.spots.discardUpload, { storageId: stray });
    expect(await t.run((ctx) => ctx.storage.getUrl(stray))).toBeNull();
  });

  test("dropping or deleting a spot's photos removes the files and their claims", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const [first, second] = await t.run(async (ctx) => [
      await ctx.storage.store(new Blob(["one"])),
      await ctx.storage.store(new Blob(["two"])),
    ]);
    const id = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [first, second] });

    await asAlice.mutation(api.spots.update, { ...SPOT, id, photoIds: [second] });
    expect(await t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(second))).not.toBeNull();

    await asAlice.mutation(api.spots.remove, { id });
    expect(await t.run((ctx) => ctx.storage.getUrl(second))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("spotPhotos").take(10))).toEqual([]);
  });
});
