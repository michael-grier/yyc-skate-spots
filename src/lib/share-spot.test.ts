import { describe, expect, test } from "vitest";
import { spotShareUrl } from "@/lib/share-spot";

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
