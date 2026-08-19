import { internalMutation } from "./_generated/server";

// Development fixture spots around Calgary. Coordinates are approximate.
// createdBy is a sentinel no Clerk tokenIdentifier can equal, so seeded
// spots are browsable but not editable through the app.
const SEED_OWNER = "seed";

const SEED_SPOTS = [
  {
    name: "Olympic Plaza Ledges",
    type: "ledge",
    bustFactor: "medium",
    surface: "smooth",
    notes: "Downtown granite ledges, knee to waist high. Busy at lunch, quiet evenings.",
    latitude: 51.0459,
    longitude: -114.0581,
  },
  {
    name: "Shaw Millennium Park",
    type: "other",
    bustFactor: "low",
    surface: "smooth",
    notes: "Legendary free 24/7 park. Everything from bowls to street section.",
    latitude: 51.0447,
    longitude: -114.0846,
  },
  {
    name: "Chinook 10-Ledge",
    type: "ledge",
    bustFactor: "high",
    surface: "smooth",
    notes: "Waxed granite out front of the north entrance. Security laps weekend afternoons.",
    latitude: 50.9982,
    longitude: -114.074,
  },
  {
    name: "U of C Kickflip Stairs",
    type: "stairs",
    bustFactor: "low",
    surface: "rough",
    notes: "Campus 6-stair with a clean run-up. Dead quiet on weekends and all summer.",
    latitude: 51.0784,
    longitude: -114.1336,
  },
  {
    name: "Eau Claire Manny Pads",
    type: "manny_pad",
    bustFactor: "medium",
    surface: "smooth",
    notes: "Low pads by the plaza fountain. Watch for pedestrians on nice days.",
    latitude: 51.0533,
    longitude: -114.068,
  },
  {
    name: "Bankers Hall Rail",
    type: "rail",
    bustFactor: "high",
    surface: "smooth",
    notes: "Round handrail on the +15 stairs. Fast bust — go early Sunday morning.",
    latitude: 51.0453,
    longitude: -114.0687,
  },
  {
    name: "Crescent Heights Curbs",
    type: "ledge",
    bustFactor: "low",
    surface: "rough",
    notes: "Painted curbs at the lookout with the skyline behind you. Golden at sunset.",
    latitude: 51.0605,
    longitude: -114.0625,
  },
  {
    name: "Beltline Alley Gap",
    type: "gap",
    bustFactor: "medium",
    surface: "rough",
    notes: "Loading-dock gap off 11th Ave. Landing is a bit gravelly — sweep first.",
    latitude: 51.0415,
    longitude: -114.0765,
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
        photoIds: [],
        createdBy: SEED_OWNER,
        createdByName: "YYC Skate Spots",
      });
    }
    return `Seeded ${SEED_SPOTS.length} spots.`;
  },
});
