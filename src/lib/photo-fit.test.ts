import { describe, expect, test } from "vitest";

import { containedSize } from "@/lib/photo-fit";

const viewport = { width: 400, height: 800 };

describe("containedSize", () => {
  test("fits a landscape photo to the viewport width", () => {
    expect(containedSize({ width: 4000, height: 3000 }, viewport)).toEqual({
      width: 400,
      height: 300,
    });
  });

  test("fits a portrait photo to the viewport height", () => {
    expect(containedSize({ width: 1200, height: 4800 }, viewport)).toEqual({
      width: 200,
      height: 800,
    });
  });

  test("falls back to the viewport for an unmeasured or degenerate photo", () => {
    expect(containedSize(undefined, viewport)).toEqual(viewport);
    expect(containedSize({ width: 0, height: 0 }, viewport)).toEqual(viewport);
  });
});
