/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Harness = ReturnType<typeof convexTest>;
type Identity = ReturnType<Harness["withIdentity"]>;

/** Stores a file and records `as` as its uploader, as the /upload action does. */
async function uploadAs(t: Harness, as: Identity, bytes: string) {
  const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([bytes])));
  await as.mutation(internal.spots.recordUpload, { storageId });
  return storageId;
}

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
    expect(updated?.status).toBe("active");
    if (updated?.status !== "active") throw new Error("Expected an active spot.");
    expect(updated.bustFactor).toBe("low");
    expect(updated.createdByName).toBe("Alice");

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
    expect(spot?.status).toBe("active");
    if (spot?.status !== "active") throw new Error("Expected an active spot.");
    expect(spot.notes).toBeUndefined();
    expect(spot.surface).toBeUndefined();
    expect(spot.createdByName).toBeUndefined();
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

  test("accepts skate parks, DIYs, wallrides, and flatground spots", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const types = ["skate_park", "diy", "wallride", "flatground"] as const;

    const id = await asAlice.mutation(api.spots.create, { ...SPOT, types: [...types] });
    const spot = await t.query(api.spots.get, { id });

    expect(spot?.status).toBe("active");
    if (spot?.status !== "active") throw new Error("Expected an active spot.");
    expect(spot.types).toEqual(types);
  });

  test("photo storage ids are never exposed to non-owners", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const photoId = await uploadAs(t, asAlice, "jpeg bytes");

    const id = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [photoId] });

    const anonymous = await t.query(api.spots.get, { id });
    expect(anonymous?.status).toBe("active");
    if (anonymous?.status !== "active") throw new Error("Expected an active spot.");
    expect(anonymous.isOwner).toBe(false);
    expect(anonymous.photoIds).toBeNull();
    expect(anonymous).not.toHaveProperty("createdBy");
    expect((await t.query(api.spots.list, {}))[0]).not.toHaveProperty("photoIds");

    const asOwner = await asAlice.query(api.spots.get, { id });
    expect(asOwner?.status).toBe("active");
    if (asOwner?.status !== "active") throw new Error("Expected an active spot.");
    expect(asOwner.isOwner).toBe(true);
    expect(asOwner.photoIds).toEqual([photoId]);
  });

  test("a photo attached to one spot cannot be attached to another", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const photoId = await uploadAs(t, asAlice, "jpeg bytes");

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
    expect(spot?.status).toBe("active");
    if (spot?.status !== "active") throw new Error("Expected an active spot.");
    expect(spot.photoUrls).toHaveLength(1);
  });

  test("list flags the caller's own spots and mine lists only those", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    await asAlice.mutation(api.spots.create, { ...SPOT, name: "Alice's" });
    await asBob.mutation(api.spots.create, { ...SPOT, name: "Bob's" });

    const seenByAlice = await asAlice.query(api.spots.list, {});
    expect(seenByAlice.map((s) => [s.name, s.isMine])).toEqual([
      ["Alice's", true],
      ["Bob's", false],
    ]);
    expect((await t.query(api.spots.list, {})).every((s) => !s.isMine)).toBe(true);

    expect((await asBob.query(api.spots.mine, {})).map((s) => s.name)).toEqual(["Bob's"]);
    expect(await t.query(api.spots.mine, {})).toEqual([]);
  });

  test("get returns null for a malformed id instead of throwing", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.spots.get, { id: "not-a-real-id" })).toBeNull();
  });

  test("only the uploader can attach or discard a pending upload", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });
    const alicesUpload = await uploadAs(t, asAlice, "stray");
    const unregistered = await t.run(async (ctx) => await ctx.storage.store(new Blob(["raw"])));

    // Bob has Alice's id somehow: he can neither attach nor delete it.
    await expect(
      asBob.mutation(api.spots.create, { ...SPOT, photoIds: [alicesUpload] }),
    ).rejects.toThrow(/uploaded by you/);
    await expect(
      asBob.mutation(api.spots.discardUpload, { storageId: alicesUpload }),
    ).rejects.toThrow(/your pending uploads/);
    await expect(t.mutation(api.spots.discardUpload, { storageId: alicesUpload })).rejects.toThrow(
      /signed in/,
    );
    expect(await t.run((ctx) => ctx.storage.getUrl(alicesUpload))).not.toBeNull();

    // A file that was never registered can't be attached by anyone either.
    await expect(
      asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [unregistered] }),
    ).rejects.toThrow(/uploaded by you/);

    await asAlice.mutation(api.spots.discardUpload, { storageId: alicesUpload });
    expect(await t.run((ctx) => ctx.storage.getUrl(alicesUpload))).toBeNull();
  });

  test("an attached photo is no longer a pending upload", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const photoId = await uploadAs(t, asAlice, "attached");
    await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [photoId] });

    await expect(asAlice.mutation(api.spots.discardUpload, { storageId: photoId })).rejects.toThrow(
      /your pending uploads/,
    );
    expect(await t.run((ctx) => ctx.db.query("uploads").take(10))).toEqual([]);
  });

  test("/upload stores the file and records the uploader in one request", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const image = { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: "jpeg bytes" };

    expect((await t.fetch("/upload", image)).status).toBe(401);
    expect(
      (await asAlice.fetch("/upload", { ...image, headers: { "Content-Type": "text/plain" } }))
        .status,
    ).toBe(415);

    const response = await asAlice.fetch("/upload", image);
    expect(response.status).toBe(200);
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.query("uploads").take(10))).toMatchObject([{ storageId }]);

    // And it is usable exactly like any other upload of Alice's.
    const id = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [storageId] });
    const spot = await t.query(api.spots.get, { id });
    expect(spot?.status).toBe("active");
    if (spot?.status !== "active") throw new Error("Expected an active spot.");
    expect(spot.photoUrls).toHaveLength(1);
  });

  test("dropping or deleting a spot's photos removes the files and their claims", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const first = await uploadAs(t, asAlice, "one");
    const second = await uploadAs(t, asAlice, "two");
    const id = await asAlice.mutation(api.spots.create, { ...SPOT, photoIds: [first, second] });

    await asAlice.mutation(api.spots.update, { ...SPOT, id, photoIds: [second] });
    expect(await t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(second))).not.toBeNull();

    await asAlice.mutation(api.spots.remove, { id });
    expect(await t.run((ctx) => ctx.storage.getUrl(second))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("spotPhotos").take(10))).toEqual([]);
  });
});
