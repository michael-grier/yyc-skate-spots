import { expect, test } from "vitest";

import { convexSiteUrl } from "./convex-site";

test("convexSiteUrl maps the cloud deployment URL to its HTTP actions host", () => {
  expect(convexSiteUrl("https://happy-otter-123.convex.cloud")).toBe(
    "https://happy-otter-123.convex.site",
  );
  // Self-hosted or already-.site URLs pass through untouched.
  expect(convexSiteUrl("https://convex.example.com")).toBe("https://convex.example.com");
});
