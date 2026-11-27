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
  bustFactor: "low" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};
const PAGE = { paginationOpts: { numItems: 10, cursor: null } };

function setup() {
  const t = convexTest(schema, modules);
  return {
    t,
    asAlice: t.withIdentity({ subject: "alice", tokenIdentifier: "clerk|alice" }),
    asBob: t.withIdentity({ subject: "bob", tokenIdentifier: "clerk|bob" }),
    asAdmin: t.withIdentity({ subject: "admin", role: "admin", tokenIdentifier: "clerk|admin" }),
  };
}

async function aliceSpot({ asAlice }: ReturnType<typeof setup>) {
  await asAlice.mutation(api.moderation.acknowledgeStandards, {});
  return await asAlice.mutation(api.spots.create, SPOT);
}

describe("updates", () => {
  test("publishing tells the owner, and clearing reports tells each reporter", async () => {
    const harness = setup();
    const { asAlice, asBob, asAdmin } = harness;
    const id = await aliceSpot(harness);

    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    expect((await asAlice.query(api.notices.list, PAGE)).page).toMatchObject([
      { kind: "spot_published", spotId: id, spotName: SPOT.name },
    ]);

    await asBob.mutation(api.reports.create, { spotId: id, reason: "duplicate_or_inaccurate" });
    await asAdmin.mutation(api.reports.create, { spotId: id, reason: "other" });
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    // A spot that was already live sends its owner nothing new.
    expect((await asAlice.query(api.notices.list, PAGE)).page).toHaveLength(1);
    expect((await asBob.query(api.notices.list, PAGE)).page).toMatchObject([
      { kind: "report_kept", spotId: id, reason: "duplicate_or_inaccurate" },
    ]);
    // The admin who reported and then decided gets no update about it.
    expect((await asAdmin.query(api.notices.list, PAGE)).page).toEqual([]);
  });

  test("removal sends the owner the admin's message and each reporter the outcome", async () => {
    const harness = setup();
    const { asAlice, asBob, asAdmin } = harness;
    const id = await aliceSpot(harness);
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    await asBob.mutation(api.reports.create, { spotId: id, reason: "private_or_sensitive" });
    // The owner's rename is unreviewed, so the reporter must only ever see the live name.
    await asAlice.mutation(api.spots.update, { ...SPOT, id, name: "Unapproved name" });

    await asAdmin.mutation(api.moderation.removeSpot, {
      spotId: id,
      reason: "private_or_sensitive",
      ownerMessage: "It's a staff-only loading dock.",
      details: "Internal only",
    });

    expect((await asAlice.query(api.notices.list, PAGE)).page[0]).toMatchObject({
      kind: "spot_removed",
      spotId: id,
      reason: "private_or_sensitive",
      message: "It's a staff-only loading dock.",
    });
    const [reporterNotice] = (await asBob.query(api.notices.list, PAGE)).page;
    expect(reporterNotice).toMatchObject({ kind: "report_removed", spotName: SPOT.name });
    // Reporters never see the admin's words to the owner, and the gone spot has no link.
    expect(reporterNotice).not.toHaveProperty("message");
    expect(reporterNotice).not.toHaveProperty("spotId");
  });

  test("a reporter's update keeps the name they reported after a rename", async () => {
    const harness = setup();
    const { asAlice, asBob, asAdmin } = harness;
    const id = await aliceSpot(harness);
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    await asBob.mutation(api.reports.create, { spotId: id, reason: "other" });
    await asAlice.mutation(api.spots.update, { ...SPOT, id, name: "Renamed Ledge" });

    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    expect((await asBob.query(api.notices.list, PAGE)).page).toMatchObject([
      { kind: "report_kept", spotName: SPOT.name },
    ]);
  });

  test("seed spots and accounts being deleted get no updates", async () => {
    const { t, asAdmin } = setup();
    const seeded = await t.run((ctx) => ctx.db.insert("spots", { ...SPOT, createdBy: "seed" }));
    const deleting = await t.run(async (ctx) => {
      await ctx.db.insert("accountDeletionRequests", {
        userIdentifier: "clerk|leaving",
        clerkUserId: "user_leaving",
        requestedAt: Date.now(),
        appleRevoked: false,
      });
      return await ctx.db.insert("spots", { ...SPOT, createdBy: "clerk|leaving" });
    });

    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: seeded });
    await asAdmin.mutation(api.moderation.removeSpot, { spotId: deleting, reason: "other" });
    expect(await t.run((ctx) => ctx.db.query("notices").collect())).toEqual([]);
  });

  test("the badge counts and clears only the caller's own unread updates", async () => {
    const harness = setup();
    const { t, asAlice, asBob, asAdmin } = harness;
    const id = await aliceSpot(harness);
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });

    expect(await t.query(api.notices.unreadCount, {})).toBe(0);
    expect((await t.query(api.notices.list, PAGE)).page).toEqual([]);
    expect(await asAlice.query(api.notices.unreadCount, {})).toBe(1);
    const [notice] = (await asAlice.query(api.notices.list, PAGE)).page;
    expect(notice).not.toHaveProperty("recipient");

    await asBob.mutation(api.notices.markRead, { ids: [notice._id] });
    expect(await asAlice.query(api.notices.unreadCount, {})).toBe(1);
    await asAlice.mutation(api.notices.markRead, { ids: [notice._id] });
    expect(await asAlice.query(api.notices.unreadCount, {})).toBe(0);
  });
});
