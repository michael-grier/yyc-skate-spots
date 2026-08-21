import { describe, expect, test } from "vitest";

import { directionsUrl } from "./directions";

const CHINOOK = { name: "Chinook 10-Ledge", latitude: 50.9982, longitude: -114.074 };

describe("directionsUrl", () => {
  test("iOS prefers Google Maps when installed", () => {
    expect(directionsUrl("ios", CHINOOK, true)).toBe("comgooglemaps://?daddr=50.9982,-114.074");
  });

  test("iOS falls back to Apple Maps with the spot name", () => {
    expect(directionsUrl("ios", CHINOOK, false)).toBe(
      "maps://?daddr=50.9982,-114.074&q=Chinook%2010-Ledge",
    );
  });

  test("Android uses the universal Google Maps directions URL regardless", () => {
    const url = "https://www.google.com/maps/dir/?api=1&destination=50.9982,-114.074";
    expect(directionsUrl("android", CHINOOK, true)).toBe(url);
    expect(directionsUrl("android", CHINOOK, false)).toBe(url);
  });
});
