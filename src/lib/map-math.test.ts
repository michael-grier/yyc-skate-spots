import { describe, expect, test } from "vitest";

import {
  MAX_ZOOM,
  framingAround,
  paddingAboveKeyboard,
  regionAtZoom,
  regionToBbox,
  zoomForRegion,
} from "./map-math";

const CALGARY = {
  latitude: 51.0447,
  longitude: -114.0719,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

describe("zoomForRegion", () => {
  test("halving the longitude span adds one zoom level", () => {
    expect(zoomForRegion({ ...CALGARY, longitudeDelta: 360 })).toBe(0);
    expect(zoomForRegion({ ...CALGARY, longitudeDelta: 360 / 2 ** 10 })).toBe(10);
    expect(zoomForRegion(CALGARY)).toBeCloseTo(10.006, 2);
  });
});

describe("regionToBbox", () => {
  test("returns [west, south, east, north] around the centre", () => {
    const [west, south, east, north] = regionToBbox({
      latitude: 51,
      longitude: -114,
      latitudeDelta: 0.2,
      longitudeDelta: 0.4,
    });
    expect(west).toBeCloseTo(-114.2);
    expect(east).toBeCloseTo(-113.8);
    expect(south).toBeCloseTo(50.9);
    expect(north).toBeCloseTo(51.1);
  });
});

describe("regionAtZoom", () => {
  const centre = { latitude: 51.05, longitude: -114.06 };

  test("centres on the target and keeps the current aspect ratio", () => {
    const current = { ...CALGARY, latitudeDelta: 0.7, longitudeDelta: 0.35 };
    const region = regionAtZoom(centre, 14, current);
    expect(region.latitude).toBe(centre.latitude);
    expect(region.longitude).toBe(centre.longitude);
    expect(region.longitudeDelta).toBeCloseTo(360 / 2 ** 14);
    expect(region.latitudeDelta / region.longitudeDelta).toBeCloseTo(2);
  });

  test("clamps to MAX_ZOOM so co-located spots don't zoom forever", () => {
    const clamped = regionAtZoom(centre, 25, CALGARY);
    expect(clamped.longitudeDelta).toBeCloseTo(360 / 2 ** MAX_ZOOM);
  });
});

describe("paddingAboveKeyboard", () => {
  const padding = { top: 232, bottom: 230, left: 48, right: 48 };

  test("frames pins between the suggestion list and the keyboard", () => {
    const result = paddingAboveKeyboard(padding, {
      mapHeight: 791,
      chromeBottom: 300,
      keyboardTop: 546,
    });
    expect(result).toEqual({ top: 348, bottom: 293, left: 48, right: 48 });
  });

  test("keeps room to frame into when a long list meets the keyboard", () => {
    const result = paddingAboveKeyboard(padding, {
      mapHeight: 791,
      chromeBottom: 500,
      keyboardTop: 546,
    });
    expect(result.bottom).toBe(293);
    expect(791 - result.top - result.bottom).toBe(120);
  });
});

describe("framingAround", () => {
  const spot = { latitude: 51.05, longitude: -114.06 };

  function centreOf(points: { latitude: number; longitude: number }[]) {
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }

  test("spans at least the minimum around the spot", () => {
    const points = framingAround(spot, 0.01, null);
    expect(centreOf(points).latitude).toBeCloseTo(spot.latitude);
    expect(centreOf(points).longitude).toBeCloseTo(spot.longitude);
    expect(Math.max(...points.map((p) => p.latitude)) - spot.latitude).toBeCloseTo(0.005);
  });

  test("includes the user while staying centred on the spot", () => {
    const user = { latitude: 51.08, longitude: -114.12 };
    const points = framingAround(spot, 0.01, user);
    expect(points).toContainEqual(user);
    expect(centreOf(points).latitude).toBeCloseTo(spot.latitude);
    expect(centreOf(points).longitude).toBeCloseTo(spot.longitude);
  });
});
