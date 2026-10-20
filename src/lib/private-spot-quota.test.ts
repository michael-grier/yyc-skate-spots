import { describe, expect, test } from "vitest";

import { privateSpotQuota } from "@/lib/private-spot-quota";

const spot = (_id: string, status: "active" | "pending" | "private" | "removed") => ({
  _id,
  status,
});

describe("privateSpotQuota", () => {
  test("counts private spots against an allowance earned by published ones only", () => {
    const quota = privateSpotQuota([
      spot("a", "private"),
      spot("b", "active"),
      spot("c", "pending"),
      spot("d", "removed"),
    ]);
    expect(quota).toEqual({ used: 1, allowed: 6 });
  });

  test("leaves the spot being edited out of both sides", () => {
    const spots = [spot("a", "private"), spot("b", "active")];
    expect(privateSpotQuota(spots, "a")).toEqual({ used: 0, allowed: 6 });
    expect(privateSpotQuota(spots, "b")).toEqual({ used: 1, allowed: 3 });
  });
});
