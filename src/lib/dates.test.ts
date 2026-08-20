import { expect, test } from "vitest";

import { formatMonthYear } from "./dates";

test("formatMonthYear renders a short month and two-digit year", () => {
  expect(formatMonthYear(new Date(2026, 5, 15).getTime())).toBe("Jun ’26");
  expect(formatMonthYear(new Date(2031, 0, 1).getTime())).toBe("Jan ’31");
});
