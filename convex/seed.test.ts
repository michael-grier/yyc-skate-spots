/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("moderation workflow fixture", () => {
  test("refuses to run unless test fixtures are enabled", async () => {
    vi.stubEnv("TEST_FIXTURES_ENABLED", "");
    const t = convexTest(schema, modules);

    await expect(t.mutation(internal.seed.createModerationScenario, {})).rejects.toThrow(
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
});
