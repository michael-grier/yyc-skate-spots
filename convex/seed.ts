import type { Doc } from "./_generated/dataModel";
import { env, internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { requireIdentity } from "./auth";
import { MODERATION_FIXTURE_OWNER, SEED_OWNER } from "./constants";

const MODERATION_FIXTURE_REPORTER = "seed:moderation-reporter";
const BANNED_USER_FIXTURE_ADMIN = "seed:banned-user-scenario";
const BANNED_USER_FIXTURE_NAME = "Banned Workflow Test User";
const BANNED_USER_FIXTURE_ACTIVE_SPOT = "Banned User Test Spot";
const BANNED_USER_FIXTURE_NOTES =
  "Development fixture for testing the signed-in experience after a contribution ban.";
const BANNED_USER_FIXTURE_REMOVALS = [
  "Removed Test Spot 1",
  "Removed Test Spot 2",
  "Removed Test Spot 3",
] as const;
const MAX_MODERATION_FIXTURE_ROWS = 20;

function requireTestFixturesEnabled() {
  if (env.TEST_FIXTURES_ENABLED !== "true") {
    throw new Error(
      "Test fixtures are disabled. Set TEST_FIXTURES_ENABLED=true on the development deployment.",
    );
  }
}

/** Deletes one fixture spot and its bounded child rows. */
async function deleteFixtureSpot(ctx: MutationCtx, spot: Doc<"spots">) {
  let deletedRecords = 0;
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
  return deletedRecords + 1;
}

/** Removes every record owned by the repeatable moderation workflow fixture. */
async function clearModerationScenarioData(ctx: MutationCtx) {
  let deletedRecords = 0;
  const spots = await ctx.db
    .query("spots")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", MODERATION_FIXTURE_OWNER))
    .take(MAX_MODERATION_FIXTURE_ROWS);

  for (const spot of spots) {
    deletedRecords += await deleteFixtureSpot(ctx, spot);
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

/** Removes only the rows created for one real banned-user test identity. */
async function clearBannedUserScenarioData(ctx: MutationCtx, userIdentifier: string) {
  let deletedRecords = 0;
  const spots = await ctx.db
    .query("spots")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", userIdentifier))
    .take(MAX_MODERATION_FIXTURE_ROWS);
  for (const spot of spots) {
    if (spot.name === BANNED_USER_FIXTURE_ACTIVE_SPOT && spot.notes === BANNED_USER_FIXTURE_NOTES) {
      deletedRecords += await deleteFixtureSpot(ctx, spot);
    }
  }

  const removals = await ctx.db
    .query("spotRemovals")
    .withIndex("by_createdBy_and_spotCreationTime", (q) => q.eq("createdBy", userIdentifier))
    .take(MAX_MODERATION_FIXTURE_ROWS);
  for (const removal of removals) {
    if (removal.removedBy === BANNED_USER_FIXTURE_ADMIN) {
      await ctx.db.delete("spotRemovals", removal._id);
      deletedRecords += 1;
    }
  }

  const contributor = await ctx.db
    .query("userModeration")
    .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", userIdentifier))
    .unique();
  if (contributor?.name === BANNED_USER_FIXTURE_NAME) {
    await ctx.db.delete("userModeration", contributor._id);
    deletedRecords += 1;
  }
  return deletedRecords;
}

// Development fixture spots around Calgary, from the maintainer's own list.
// Older deployments used this sentinel, so claimSeededSpots can transfer
// those rows to the maintainer without touching user-created spots.
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

function seedSpotFingerprint(spot: {
  name: string;
  types: readonly string[];
  bustFactor: string;
  surface?: string;
  notes?: string;
  latitude: number;
  longitude: number;
}) {
  return JSON.stringify([
    spot.name,
    spot.types,
    spot.bustFactor,
    spot.surface ?? null,
    spot.notes ?? null,
    spot.latitude,
    spot.longitude,
  ]);
}

const SEED_SPOT_FINGERPRINTS = new Set(SEED_SPOTS.map(seedSpotFingerprint));

/** Requires an explicit CLI identity so seeded spots always have a real owner. */
async function requireSeedOwner(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Run this command with --identity so the seeded spots have an owner.");
  }
  if (
    !env.SEED_OWNER_TOKEN_IDENTIFIER ||
    identity.tokenIdentifier !== env.SEED_OWNER_TOKEN_IDENTIFIER
  ) {
    throw new Error("Only the configured seed owner can run this command.");
  }
  if (!identity.name?.trim()) {
    throw new Error('The --identity value must include a non-empty "name".');
  }
  return { tokenIdentifier: identity.tokenIdentifier, name: identity.name.trim() };
}

/** Idempotent fixture loader for an explicitly selected Convex deployment. */
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireSeedOwner(ctx);
    const existing = await ctx.db.query("spots").take(1);
    if (existing.length > 0) {
      return "Spots table is not empty; seed skipped.";
    }
    for (const spot of SEED_SPOTS) {
      await ctx.db.insert("spots", {
        ...spot,
        types: [...spot.types],
        photoIds: [],
        createdBy: owner.tokenIdentifier,
        createdByName: owner.name,
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

/** Authenticated dev fixture; public so the CLI can supply a real test identity. */
export const createBannedUserScenario = mutation({
  args: {},
  handler: async (ctx) => {
    requireTestFixturesEnabled();
    const identity = await requireIdentity(ctx);
    if (identity.role === "admin") {
      throw new Error("Use a non-admin Clerk test user for the banned-user fixture.");
    }

    const existingContributor = await ctx.db
      .query("userModeration")
      .withIndex("by_userIdentifier", (q) => q.eq("userIdentifier", identity.tokenIdentifier))
      .unique();
    if (existingContributor && existingContributor.name !== BANNED_USER_FIXTURE_NAME) {
      throw new Error("This user already has a non-fixture moderation record.");
    }
    await clearBannedUserScenarioData(ctx, identity.tokenIdentifier);

    const removedSpotIds = [];
    for (const [index, name] of BANNED_USER_FIXTURE_REMOVALS.entries()) {
      const spotId = await ctx.db.insert("spots", {
        name,
        types: ["ledge"],
        bustFactor: "low",
        surface: "smooth",
        notes: BANNED_USER_FIXTURE_NOTES,
        latitude: 51.045 + index * 0.0001,
        longitude: -114.0572,
        photoIds: [],
        createdBy: identity.tokenIdentifier,
        createdByName: BANNED_USER_FIXTURE_NAME,
      });
      const spot = await ctx.db.get("spots", spotId);
      if (!spot) {
        throw new Error("Failed to create a banned-user fixture removal.");
      }
      await ctx.db.insert("spotRemovals", {
        spotId,
        spotCreationTime: spot._creationTime,
        name,
        createdBy: identity.tokenIdentifier,
        createdByName: BANNED_USER_FIXTURE_NAME,
        reason: "spam_or_abuse",
        removedAt: Date.now(),
        removedBy: BANNED_USER_FIXTURE_ADMIN,
        reportCount: 1,
        strikeNumber: index + 1,
      });
      await ctx.db.delete("spots", spotId);
      removedSpotIds.push(spotId);
    }

    const activeSpotId = await ctx.db.insert("spots", {
      name: BANNED_USER_FIXTURE_ACTIVE_SPOT,
      types: ["ledge"],
      bustFactor: "low",
      surface: "smooth",
      notes: BANNED_USER_FIXTURE_NOTES,
      latitude: 51.0453,
      longitude: -114.0572,
      photoIds: [],
      createdBy: identity.tokenIdentifier,
      createdByName: BANNED_USER_FIXTURE_NAME,
    });
    await ctx.db.insert("userModeration", {
      userIdentifier: identity.tokenIdentifier,
      name: BANNED_USER_FIXTURE_NAME,
      confirmedRemovalCount: 3,
      isBanned: true,
      bannedAt: Date.now(),
      bannedBy: BANNED_USER_FIXTURE_ADMIN,
    });

    return {
      activeSpotId,
      removedSpotIds,
      message: "Created a banned-user scenario with three removal notices and one active spot.",
    };
  },
});

/** Clears the banned-user rows belonging to the authenticated test identity. */
export const clearBannedUserScenario = mutation({
  args: {},
  handler: async (ctx) => {
    requireTestFixturesEnabled();
    const identity = await requireIdentity(ctx);
    const deletedRecords = await clearBannedUserScenarioData(ctx, identity.tokenIdentifier);
    return { deletedRecords, message: "Cleared the banned-user workflow fixture." };
  },
});

/** Transfers legacy seed-owned spots to the CLI identity running this migration. */
export const claimSeededSpots = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireSeedOwner(ctx);
    const unclaimedFingerprints = new Set(SEED_SPOT_FINGERPRINTS);
    let claimedCount = 0;
    const legacySpots = ctx.db
      .query("spots")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", SEED_OWNER));

    for await (const spot of legacySpots) {
      const fingerprint = seedSpotFingerprint(spot);
      // Claim at most one pristine row for each known fixture. This leaves
      // unrelated or duplicated rows using the legacy sentinel untouched.
      if (
        spot.photoIds.length > 0 ||
        spot.deletionRequested ||
        !unclaimedFingerprints.delete(fingerprint)
      ) {
        continue;
      }
      await ctx.db.patch("spots", spot._id, {
        createdBy: owner.tokenIdentifier,
        createdByName: owner.name,
      });
      claimedCount += 1;
    }

    return { claimedCount, ownerName: owner.name };
  },
});
