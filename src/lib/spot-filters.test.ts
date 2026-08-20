import { describe, expect, test } from "vitest";

import { DEFAULT_FILTERS, applyFilters, countActiveFilters } from "./spot-filters";

const DOWNTOWN = { latitude: 51.0447, longitude: -114.0719 };

const SPOTS = [
  {
    name: "Harmony Park",
    types: ["ledge", "stairs"],
    bustFactor: "medium",
    latitude: 51.049144,
    longitude: -114.063528,
  },
  {
    name: "Bowness Curbs",
    types: ["curb"],
    bustFactor: "low",
    latitude: 51.0841944,
    longitude: -114.1868889,
  },
  {
    name: "Chinatown 12 Stair",
    types: ["stairs"],
    bustFactor: "high",
    latitude: 51.050971,
    longitude: -114.065359,
  },
] as const satisfies readonly Parameters<typeof applyFilters>[0][number][];

const names = (spots: readonly { name: string }[]) => spots.map((s) => s.name);

describe("applyFilters", () => {
  test("defaults pass everything through", () => {
    expect(applyFilters([...SPOTS], DEFAULT_FILTERS, null)).toHaveLength(3);
  });

  test("search matches the name case-insensitively", () => {
    expect(
      names(applyFilters([...SPOTS], { ...DEFAULT_FILTERS, query: "  STAIR " }, null)),
    ).toEqual(["Chinatown 12 Stair"]);
  });

  test("types is any-of: a multi-type spot matches on any of its types", () => {
    const result = applyFilters([...SPOTS], { ...DEFAULT_FILTERS, types: ["ledge", "curb"] }, null);
    expect(names(result)).toEqual(["Harmony Park", "Bowness Curbs"]);
  });

  test("bust factors is one-of", () => {
    const result = applyFilters(
      [...SPOTS],
      { ...DEFAULT_FILTERS, bustFactors: ["low", "high"] },
      null,
    );
    expect(names(result)).toEqual(["Bowness Curbs", "Chinatown 12 Stair"]);
  });

  test("distance keeps spots within the radius of the user", () => {
    // Bowness is ~9 km from downtown; the other two are under 1 km.
    const result = applyFilters([...SPOTS], { ...DEFAULT_FILTERS, maxDistanceKm: 5 }, DOWNTOWN);
    expect(names(result)).toEqual(["Harmony Park", "Chinatown 12 Stair"]);
  });

  test("distance is ignored when the user's location is unknown", () => {
    expect(applyFilters([...SPOTS], { ...DEFAULT_FILTERS, maxDistanceKm: 1 }, null)).toHaveLength(
      3,
    );
  });

  test("filters combine with AND", () => {
    const result = applyFilters(
      [...SPOTS],
      { query: "", maxDistanceKm: 5, types: ["stairs"], bustFactors: ["high"] },
      DOWNTOWN,
    );
    expect(names(result)).toEqual(["Chinatown 12 Stair"]);
  });
});

describe("countActiveFilters", () => {
  test("counts the three chip filters, not search", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, query: "x" })).toBe(0);
    expect(
      countActiveFilters({ query: "", maxDistanceKm: 5, types: ["ledge"], bustFactors: ["low"] }),
    ).toBe(3);
  });
});
