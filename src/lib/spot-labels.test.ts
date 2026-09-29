import { expect, test } from "vitest";

import { SPOT_TYPE_LABELS, SPOT_TYPES } from "@/lib/spot-labels";

test("lists every spot type alphabetically, with Other last as the fallback", () => {
  const labels = SPOT_TYPES.map((type) => SPOT_TYPE_LABELS[type]);
  expect(labels.at(-1)).toBe("Other");
  expect(labels.slice(0, -1)).toEqual(labels.slice(0, -1).toSorted((a, b) => a.localeCompare(b)));
  expect(new Set(SPOT_TYPES)).toEqual(new Set(Object.keys(SPOT_TYPE_LABELS)));
});
