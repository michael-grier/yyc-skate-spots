import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { MODERATION_FIXTURE_OWNER, SEED_OWNER } from "./constants";

const MODERATION_FIXTURE_REPORTER = "seed:moderation-reporter";
const MAX_MODERATION_FIXTURE_ROWS = 20;

function requireTestFixturesEnabled() {
  if (env.TEST_FIXTURES_ENABLED !== "true") {
    throw new Error(
      "Test fixtures are disabled. Set TEST_FIXTURES_ENABLED=true on the development deployment.",
    );
  }
}

/** Removes every record owned by the repeatable moderation workflow fixture. */
async function clearModerationScenarioData(ctx: MutationCtx) {
  let deletedRecords = 0;
  const spots = await ctx.db
    .query("spots")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", MODERATION_FIXTURE_OWNER))
    .take(MAX_MODERATION_FIXTURE_ROWS);

  for (const spot of spots) {
    const [reports, moderationRows, favorites] = await Promise.all([
      ctx.db
        .query("spotReports")
        .withIndex("by_spotId", (q) => q.eq("spotId", spot._id))
        .take(MAX_MODERATION_FIXTURE_ROWS),
      ctx.db
        .query("spotModeration")
        .withIndex("by_spotId", (q) => q.eq("spotId", spot._id))
        .take(MAX_MODERATION_FIXTURE_ROWS),
      ctx.db
        .query("favorites")
        .withIndex("by_spotId_and_userId", (q) => q.eq("spotId", spot._id))
        .take(MAX_MODERATION_FIXTURE_ROWS),
    ]);
    for (const row of [...reports, ...moderationRows, ...favorites]) {
      await ctx.db.delete(row._id);
      deletedRecords += 1;
    }
    await ctx.db.delete("spots", spot._id);
    deletedRecords += 1;
  }

  const removals = await ctx.db
    .query("spotRemovals")
    .withIndex("by_createdBy_and_spotCreationTime", (q) =>
      q.eq("createdBy", MODERATION_FIXTURE_OWNER),
    )
    .take(MAX_MODERATION_FIXTURE_ROWS);
  for (const removal of removals) {
    await ctx.db.delete("spotRemovals", removal._id);
    deletedRecords += 1;
  }

  const contributor = await ctx.db
    .query("userModeration")
    .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", MODERATION_FIXTURE_OWNER))
    .unique();
  if (contributor) {
    await ctx.db.delete("userModeration", contributor._id);
    deletedRecords += 1;
  }
  return deletedRecords;
}

// Development fixture spots around Calgary, from the maintainer's own list.
// createdBy is a sentinel no Clerk tokenIdentifier can equal, so seeded
// spots are browsable but not editable through the app.
const SEED_SPOTS = [
  {
    name: "Harmony Park",
    types: ["ledge", "stairs"],
    bustFactor: "medium",
    surface: "smooth",
    notes: "Formerly known as James Short park.",
    latitude: 51.049144,
    longitude: -114.063528,
  },
  {
    name: "Chinatown 12 Stair",
    types: ["stairs"],
    bustFactor: "medium",
    surface: "smooth",
    notes:
      "The gate generally has to be opened in order to get enough run-up. How to do that is up to you.",
    latitude: 51.050971,
    longitude: -114.065359,
  },
  {
    name: "Central Library",
    types: ["ledge"],
    bustFactor: "low",
    surface: "rough",
    notes:
      "Amazing granite ledges. Ground is cement. Low bust factor, but the kook factor is off the charts. Best to go in the morning.",
    latitude: 51.045858,
    longitude: -114.055295,
  },
  {
    name: "Poppy Plaza",
    types: ["other"],
    bustFactor: "low",
    surface: "smooth",
    notes: "Tall wooden pyramid and decent flatground. Watch out for splinters!",
    latitude: 51.051524,
    longitude: -114.085926,
  },
  {
    name: "Amvic Bank to Ledge",
    types: ["bank", "curb", "ledge"],
    bustFactor: "low",
    surface: "smooth",
    notes: "A mellow bank with a long curb/ledge at the top",
    latitude: 51.0199013,
    longitude: -114.0313298,
  },
  {
    name: "St. Patrick's Island Park",
    types: ["ledge", "stairs"],
    bustFactor: "low",
    surface: "rough",
    notes: "White concrete benches and stair sets of varying size. Ground is cement bricks",
    latitude: 51.0464383,
    longitude: -114.0373399,
  },
  {
    name: "White Concrete Bench",
    types: ["ledge"],
    bustFactor: "low",
    surface: "rough",
    notes:
      "White concrete bench, same as the ones at St. Patrick's Island. Cement brick ground is the same as well",
    latitude: 51.0483026,
    longitude: -114.045231,
  },
  {
    name: "Bowness Curbs",
    types: ["curb"],
    bustFactor: "low",
    surface: "smooth",
    notes: "Perfect double-sided curbs. DIY built",
    latitude: 51.0841944,
    longitude: -114.1868889,
  },
] as const;

/** Idempotent dev fixture loader: `npx convex run seed:run`. */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("spots").take(1);
    if (existing.length > 0) {
      return "Spots table is not empty; seed skipped.";
    }
    for (const spot of SEED_SPOTS) {
      await ctx.db.insert("spots", {
        ...spot,
        types: [...spot.types],
        photoIds: [],
        createdBy: SEED_OWNER,
        createdByName: "YYC Skate Spots",
      });
    }
    return `Seeded ${SEED_SPOTS.length} spots.`;
  },
});

/** Resets and creates one reported spot for manual admin workflow testing. */
export const createModerationScenario = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireTestFixturesEnabled();
    await clearModerationScenarioData(ctx);

    const spotId = await ctx.db.insert("spots", {
      name: "Reported Test Spot",
      types: ["ledge"],
      bustFactor: "low",
      surface: "smooth",
      notes: "Development fixture for testing the admin review and removal workflow.",
      latitude: 51.045,
      longitude: -114.0572,
      photoIds: [],
      createdBy: MODERATION_FIXTURE_OWNER,
      createdByName: "Workflow Test User",
    });
    const spot = await ctx.db.get("spots", spotId);
    if (!spot) {
      throw new Error("Failed to create the moderation fixture spot.");
    }

    const submittedAt = Date.now();
    await ctx.db.insert("spotModeration", {
      spotId,
      spotCreationTime: spot._creationTime,
      needsReview: true,
      attentionReason: "reported",
      lastSubmittedAt: submittedAt,
      openReportCount: 1,
    });
    await ctx.db.insert("spotReports", {
      spotId,
      reportedBy: MODERATION_FIXTURE_REPORTER,
      reason: "not_a_spot",
      details: "Test report: this location is not a real skate spot.",
    });
    await ctx.db.insert("userModeration", {
      userIdentifier: MODERATION_FIXTURE_OWNER,
      name: "Workflow Test User",
      confirmedRemovalCount: 2,
      isBanned: false,
    });

    return { spotId, message: "Created Reported Test Spot with one open report." };
  },
});

/** Clears the moderation workflow fixture after either review outcome. */
export const clearModerationScenario = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireTestFixturesEnabled();
    const deletedRecords = await clearModerationScenarioData(ctx);
    return { deletedRecords, message: "Cleared the moderation workflow fixture." };
  },
});
