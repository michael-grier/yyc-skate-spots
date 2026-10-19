import { describe, expect, test } from "vitest";

import {
  distanceKm,
  formatCoordinatePair,
  formatDistance,
  isInCalgary,
  parseCoordinatePair,
} from "./geo";

// Two seed spots at opposite ends of the city.
const HARMONY_PARK = { latitude: 51.049144, longitude: -114.063528 };
const BOWNESS_CURBS = { latitude: 51.0841944, longitude: -114.1868889 };

describe("distanceKm", () => {
  test("matches the known distance across Calgary", () => {
    // ~9.5 km by great-circle; a factor-of-two or degrees/radians slip
    // would land far outside this window.
    const km = distanceKm(HARMONY_PARK, BOWNESS_CURBS);
    expect(km).toBeGreaterThan(9.3);
    expect(km).toBeLessThan(9.7);
  });

  test("is symmetric and zero for the same point", () => {
    expect(distanceKm(HARMONY_PARK, BOWNESS_CURBS)).toBeCloseTo(
      distanceKm(BOWNESS_CURBS, HARMONY_PARK),
      10,
    );
    expect(distanceKm(HARMONY_PARK, HARMONY_PARK)).toBe(0);
  });
});

describe("formatDistance", () => {
  test("uses metres under a kilometre and one decimal above", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(0.0499)).toBe("50 m");
    expect(formatDistance(1)).toBe("1.0 km");
    expect(formatDistance(1.25)).toBe("1.3 km");
    expect(formatDistance(12.04)).toBe("12.0 km");
  });
});

describe("coordinate pairs", () => {
  test("parses decimal coordinates copied from common map apps", () => {
    expect(parseCoordinatePair("51.0447, -114.0719")).toEqual({
      latitude: 51.0447,
      longitude: -114.0719,
    });
    expect(parseCoordinatePair("51.0447° N, 114.0719° W")).toEqual({
      latitude: 51.0447,
      longitude: -114.0719,
    });
    expect(parseCoordinatePair("51.0447N, 114.0719W")).toEqual({
      latitude: 51.0447,
      longitude: -114.0719,
    });
    expect(parseCoordinatePair("[51.0447, -114.0719]")).toEqual({
      latitude: 51.0447,
      longitude: -114.0719,
    });
    expect(parseCoordinatePair("(51.0447, -114.0719)")).toEqual({
      latitude: 51.0447,
      longitude: -114.0719,
    });
  });

  test("rejects malformed, contradictory, and out-of-range pairs", () => {
    expect(parseCoordinatePair("51.0447 -114.0719")).toBeNull();
    expect(parseCoordinatePair("[51.0447, -114.0719)")).toBeNull();
    expect(parseCoordinatePair("-51.0447 N, -114.0719 W")).toBeNull();
    expect(parseCoordinatePair("91, -114")).toBeNull();
    expect(parseCoordinatePair("51, -181")).toBeNull();
  });

  test("formats coordinates consistently for display and editing", () => {
    expect(formatCoordinatePair({ latitude: 51.0447, longitude: -114.0719 })).toBe(
      "51.044700, -114.071900",
    );
  });
});

describe("isInCalgary", () => {
  test("includes spots across the city and just past its limits", () => {
    expect(isInCalgary(HARMONY_PARK)).toBe(true);
    expect(isInCalgary(BOWNESS_CURBS)).toBe(true);
    // About 3 km west of the city limits.
    expect(isInCalgary({ latitude: 51.17, longitude: -114.36 })).toBe(true);
  });

  test("excludes places well outside the city", () => {
    // Downtown Edmonton and Airdrie.
    expect(isInCalgary({ latitude: 53.5461, longitude: -113.4938 })).toBe(false);
    expect(isInCalgary({ latitude: 51.2917, longitude: -114.0144 })).toBe(false);
  });
});
