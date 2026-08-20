import { internalMutation } from "./_generated/server";

// Development fixture spots around Calgary, from the maintainer's own list.
// createdBy is a sentinel no Clerk tokenIdentifier can equal, so seeded
// spots are browsable but not editable through the app.
const SEED_OWNER = "seed";

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
