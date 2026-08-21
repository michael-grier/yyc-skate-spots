import { describe, expect, test } from "vitest";

import { needsExplicitSiteUrl, resolveConvexSiteUrl } from "./convex-site";

describe("resolveConvexSiteUrl", () => {
  test("prefers the configured site URL, without a trailing slash", () => {
    expect(
      resolveConvexSiteUrl("https://happy-otter-123.convex.cloud", "https://api.example.com/"),
    ).toBe("https://api.example.com");
  });

  test("derives the .site host for a default deployment when none is configured", () => {
    expect(resolveConvexSiteUrl("https://happy-otter-123.convex.cloud", undefined)).toBe(
      "https://happy-otter-123.convex.site",
    );
  });
});

test("needsExplicitSiteUrl is true only for non-default (custom) cloud URLs", () => {
  expect(needsExplicitSiteUrl("https://happy-otter-123.convex.cloud")).toBe(false);
  expect(needsExplicitSiteUrl("https://convex.example.com")).toBe(true);
});
