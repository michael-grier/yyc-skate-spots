import { describe, expect, test } from "vitest";
import { mapPinUrl, spotShareUrl } from "@/lib/share-spot";

describe("spotShareUrl", () => {
  test("builds a share link and encodes the spot id", () => {
    expect(spotShareUrl("spot/id with spaces", "https://share.example.com")).toBe(
      "https://share.example.com/share?id=spot%2Fid+with+spaces",
    );
  });

  test("accepts a trailing slash on the configured origin", () => {
    expect(spotShareUrl("spot-1", "https://share.example.com/")).toBe(
      "https://share.example.com/share?id=spot-1",
    );
  });

  test.each([
    undefined,
    "http://share.example.com",
    "https://share.example.com/base",
    "https://share.example.com:8443",
  ])("rejects an unusable base URL: %s", (baseUrl) => {
    expect(() => spotShareUrl("spot-1", baseUrl)).toThrow();
  });
});

describe("mapPinUrl", () => {
  test("points a universal maps link at the coordinates", () => {
    expect(mapPinUrl({ latitude: 51.0447, longitude: -114.0719 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=51.0447,-114.0719",
    );
  });
});
