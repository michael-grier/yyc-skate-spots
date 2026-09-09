/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const spot = {
  name: "Ledge",
  types: ["ledge" as const],
  bustFactor: "low" as const,
  latitude: 51,
  longitude: -114,
  photoIds: [],
};
const aliceIdentity = {
  subject: "alice",
  tokenIdentifier: "clerk|alice",
  name: "Alice Provider",
  email: "alice@example.com",
};

describe("display names", () => {
  test("only the verified caller can set their name, without changing provider identity", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity(aliceIdentity);
    const bob = t.withIdentity({ subject: "bob", email: "bob@example.com" });
    expect(await t.query(api.profiles.me, {})).toBeNull();
    await expect(
      t.mutation(api.profiles.setDisplayName, { displayName: "Intruder" }),
    ).rejects.toThrow(/signed in/);
    expect(await alice.query(api.profiles.me, {})).toEqual({ displayName: "Alice Provider" });
    expect(await bob.query(api.profiles.me, {})).toEqual({ displayName: null });
    await alice.mutation(api.profiles.setDisplayName, { displayName: "  Rene\u0301e O’Neil-2.  " });
    await bob.mutation(api.profiles.setDisplayName, { displayName: "Renée O’Neil-2." });
    expect(await alice.query(api.profiles.me, {})).toEqual({ displayName: "Renée O’Neil-2." });
    await bob.mutation(api.profiles.setDisplayName, { displayName: "Bob" });
    await expect(
      bob.mutation(api.profiles.setDisplayName, {
        displayName: "Impersonated",
        ...{ userIdentifier: aliceIdentity.tokenIdentifier },
      }),
    ).rejects.toThrow();
    expect(await alice.query(api.profiles.me, {})).toEqual({ displayName: "Renée O’Neil-2." });
    expect(await t.run((ctx) => ctx.db.query("profiles").collect())).toHaveLength(2);
  });

  test("enforces length and character limits on the server", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity(aliceIdentity);
    for (const displayName of [
      "",
      "   ",
      "a".repeat(41),
      "a@b.com",
      "a\nb",
      "a\u202Eb",
      "<name>",
      "🛹",
    ]) {
      await expect(alice.mutation(api.profiles.setDisplayName, { displayName })).rejects.toThrow();
    }
    for (const displayName of ["A", "王小明", "𐐀".repeat(40)]) {
      await alice.mutation(api.profiles.setDisplayName, { displayName });
      expect(await alice.query(api.profiles.me, {})).toEqual({ displayName });
    }
  });

  test("renames reach old and new public spots and private admin labels", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity(aliceIdentity);
    const admin = t.withIdentity({ subject: "admin", role: "admin" });
    await alice.mutation(api.moderation.acknowledgeStandards, {});
    const id = await alice.mutation(api.spots.create, spot);
    await admin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    const legacyId = await alice.mutation(api.spots.create, { ...spot, name: "Older name" });
    await admin.mutation(api.moderation.markMeetsStandards, { spotId: legacyId });
    await t.run((ctx) => ctx.db.patch("spots", legacyId, { createdByName: "Earlier Provider" }));
    expect(await t.query(api.spots.list, {})).toMatchObject([
      { createdByName: "Earlier Provider" },
      { createdByName: "Alice Provider" },
    ]);
    expect(await admin.query(api.moderation.listSpots, {})).toMatchObject([
      { creatorName: "Earlier Provider" },
      { creatorName: "Alice Provider" },
    ]);
    await alice.mutation(api.profiles.setDisplayName, { displayName: "Al" });
    expect(await t.query(api.spots.get, { id })).toMatchObject({
      createdByName: "Al",
      isPendingReview: false,
    });
    expect(await t.query(api.spots.list, {})).toMatchObject([
      { createdByName: "Al" },
      { createdByName: "Al" },
    ]);
    expect(await admin.query(api.moderation.getSpot, { id })).toMatchObject({
      creator: { name: "Al" },
    });
    expect(await admin.query(api.moderation.listSpots, {})).toMatchObject([
      { creatorName: "Al" },
      { creatorName: "Al" },
    ]);
    const newer = await alice.mutation(api.spots.create, { ...spot, name: "New spot" });
    expect(await alice.query(api.spots.get, { id: newer })).toMatchObject({ createdByName: "Al" });
    await alice.mutation(api.profiles.setDisplayName, { displayName: "Alice Renamed" });
    await alice.mutation(api.spots.update, { ...spot, id });
    expect(await alice.query(api.spots.get, { id })).toMatchObject({
      createdByName: "Alice Renamed",
    });
    // Old denormalized values can stay in storage; reads must resolve the current profile.
    expect(await t.run((ctx) => ctx.db.get("spots", id))).toMatchObject({
      createdByName: "Alice Provider",
    });
  });

  test("keeps email-only and email-shaped provider names out of public responses", async () => {
    const t = convexTest(schema, modules);
    const admin = t.withIdentity({ subject: "admin", role: "admin" });
    for (const name of [undefined, "private@example.com"]) {
      const owner = t.withIdentity({
        subject: `owner-${name}`,
        tokenIdentifier: `clerk|owner-${name}`,
        email: "private@example.com",
        ...(name ? { name } : {}),
      });
      await owner.mutation(api.moderation.acknowledgeStandards, {});
      const id = await owner.mutation(api.spots.create, spot);
      await admin.mutation(api.moderation.markMeetsStandards, { spotId: id });
      // Also cover old documents that already contain an email in the name field.
      await t.run((ctx) => ctx.db.patch("spots", id, { createdByName: "private@example.com" }));
      expect(await owner.query(api.profiles.me, {})).toEqual({ displayName: null });
      expect(JSON.stringify(await t.query(api.spots.get, { id }))).not.toContain(
        "private@example.com",
      );
      expect(JSON.stringify(await t.query(api.spots.list, {}))).not.toContain(
        "private@example.com",
      );
      expect(await admin.query(api.moderation.getSpot, { id })).toMatchObject({
        creator: { name: "private@example.com" },
      });
      await owner.mutation(api.profiles.setDisplayName, { displayName: "New Skater" });
      expect(await t.query(api.spots.get, { id })).toMatchObject({ createdByName: "New Skater" });
    }
  });

  test("account cleanup removes the profile and rejects renames during deletion", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity(aliceIdentity);
    await alice.mutation(api.profiles.setDisplayName, { displayName: "Al" });
    const requestId = await t.mutation(internal.accountDeletion.beginRequest, {
      userIdentifier: aliceIdentity.tokenIdentifier,
      clerkUserId: aliceIdentity.subject,
    });
    await expect(
      alice.mutation(api.profiles.setDisplayName, { displayName: "Recreated" }),
    ).rejects.toThrow(/deleting/);
    await t.mutation(internal.accountDeletion.cleanupBatch, { requestId });
    expect(await t.run((ctx) => ctx.db.query("profiles").collect())).toEqual([]);
  });
});
