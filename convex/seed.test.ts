/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("moderation workflow fixture", () => {
  test("refuses to run unless test fixtures are enabled", async () => {
    vi.stubEnv("TEST_FIXTURES_ENABLED", "");
    const t = convexTest(schema, modules);
    const asTestUser = t.withIdentity({ subject: "fixture-user" });

    await expect(t.mutation(internal.seed.createModerationScenario, {})).rejects.toThrow(
      /Test fixtures are disabled/,
    );
    await expect(asTestUser.mutation(api.seed.createBannedUserScenario, {})).rejects.toThrow(
      /Test fixtures are disabled/,
    );
  });

  test("creates a repeatable reported spot and clears it after removal", async () => {
    vi.stubEnv("TEST_FIXTURES_ENABLED", "true");
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });

    const first = await t.mutation(internal.seed.createModerationScenario, {});
    const second = await t.mutation(internal.seed.createModerationScenario, {});
    expect(second.spotId).not.toBe(first.spotId);

    const queue = await asAdmin.query(api.moderation.listSpots, {});
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      _id: second.spotId,
      name: "Reported Test Spot",
      creatorRemovalCount: 2,
      review: { needsReview: true, attentionReason: "reported", openReportCount: 1 },
    });
    expect(await asAdmin.query(api.moderation.getSpot, { id: second.spotId })).toMatchObject({
      reports: [
        {
          reason: "not_a_spot",
          details: "Test report: this location is not a real skate spot.",
        },
      ],
    });

    const removal = await asAdmin.mutation(api.moderation.removeSpot, {
      spotId: second.spotId,
      reason: "not_a_spot",
    });
    expect(removal).toMatchObject({ strikeCount: 3, eligibleForBan: true });
    expect(await asAdmin.query(api.moderation.listEligibleContributors, {})).toMatchObject([
      { name: "Workflow Test User", confirmedRemovalCount: 3 },
    ]);

    await t.mutation(internal.seed.clearModerationScenario, {});
    const remaining = await t.run(async (ctx) => ({
      spots: await ctx.db.query("spots").take(10),
      reports: await ctx.db.query("spotReports").take(10),
      moderation: await ctx.db.query("spotModeration").take(10),
      removals: await ctx.db.query("spotRemovals").take(10),
      contributors: await ctx.db.query("userModeration").take(10),
    }));
    expect(remaining).toEqual({
      spots: [],
      reports: [],
      moderation: [],
      removals: [],
      contributors: [],
    });
  });

  test("creates and clears a banned-user scenario for the supplied identity", async () => {
    vi.stubEnv("TEST_FIXTURES_ENABLED", "true");
    const t = convexTest(schema, modules);
    const identity = {
      subject: "fixture-user",
      issuer: "https://fixture.clerk.accounts.dev",
      name: "Clerk Test User",
    };
    const asTestUser = t.withIdentity(identity);
    const asOtherUser = t.withIdentity({ subject: "other-user" });

    const first = await asTestUser.mutation(api.seed.createBannedUserScenario, {});
    const second = await asTestUser.mutation(api.seed.createBannedUserScenario, {});
    expect(second.activeSpotId).not.toBe(first.activeSpotId);
    expect(second.removedSpotIds).toHaveLength(3);
    expect(await asTestUser.query(api.moderation.viewer, {})).toMatchObject({
      isBanned: true,
      confirmedRemovalCount: 3,
    });

    const mine = await asTestUser.query(api.spots.mine, {});
    expect(mine).toHaveLength(4);
    expect(mine).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "active",
          _id: second.activeSpotId,
          name: "Banned User Test Spot",
        }),
        ...[1, 2, 3].map((strikeNumber) =>
          expect.objectContaining({ status: "removed", strikeNumber }),
        ),
      ]),
    );
    expect(await asTestUser.query(api.spots.get, { id: second.removedSpotIds[2] })).toMatchObject({
      status: "removed",
      strikeNumber: 3,
    });
    expect(await asOtherUser.query(api.spots.get, { id: second.removedSpotIds[2] })).toBeNull();
    await expect(asTestUser.mutation(api.spots.create, SPOT)).rejects.toThrow(/access/);
    await expect(
      asTestUser.mutation(api.spots.update, {
        ...SPOT,
        id: second.activeSpotId,
        name: "Changed",
      }),
    ).rejects.toThrow(/access/);
    await expect(
      asTestUser.mutation(api.spots.remove, { id: second.activeSpotId }),
    ).resolves.toBeNull();

    await asTestUser.mutation(api.seed.clearBannedUserScenario, {});
    expect(await asTestUser.query(api.moderation.viewer, {})).toMatchObject({
      isBanned: false,
      confirmedRemovalCount: 0,
    });
    expect(await asTestUser.query(api.spots.mine, {})).toEqual([]);
  });

  test("refuses to apply the banned-user fixture to an admin identity", async () => {
    vi.stubEnv("TEST_FIXTURES_ENABLED", "true");
    const t = convexTest(schema, modules);
    const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });

    await expect(asAdmin.mutation(api.seed.createBannedUserScenario, {})).rejects.toThrow(
      /non-admin Clerk test user/,
    );
  });
});
