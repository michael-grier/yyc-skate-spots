import { describe, expect, test } from "vitest";
import { publicSiteUrl } from "@/lib/public-site";

describe("publicSiteUrl", () => {
  test.each(["privacy", "support", "standards", "share"] as const)(
    "builds the %s page URL",
    (page) => {
      expect(publicSiteUrl(page, "https://yycskatespots.com/")).toBe(
        `https://yycskatespots.com/${page}`,
      );
    },
  );

  test.each([
    "",
    "http://yycskatespots.com",
    "https://yycskatespots.com/base",
    "https://yycskatespots.com:8443",
  ])("rejects an unusable base URL: %s", (baseUrl) => {
    expect(() => publicSiteUrl("privacy", baseUrl)).toThrow();
  });
});
