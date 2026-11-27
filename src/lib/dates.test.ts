import { expect, test } from "vitest";

import { formatMonthYear, formatNoticeTime } from "./dates";

test("formatMonthYear renders a short month and two-digit year", () => {
  expect(formatMonthYear(new Date(2026, 5, 15).getTime())).toBe("Jun ’26");
  expect(formatMonthYear(new Date(2031, 0, 1).getTime())).toBe("Jan ’31");
});

test("formatNoticeTime counts hours, then calendar days, then shows the date", () => {
  const now = new Date(2026, 10, 27, 9, 0).getTime();
  expect(formatNoticeTime(now - 20_000, now)).toBe("1m");
  expect(formatNoticeTime(new Date(2026, 10, 27, 7, 0).getTime(), now)).toBe("2h");
  // Past 24 hours, ages go by calendar day.
  expect(formatNoticeTime(new Date(2026, 10, 26, 8, 0).getTime(), now)).toBe("Yesterday");
  expect(formatNoticeTime(new Date(2026, 10, 24, 23, 0).getTime(), now)).toBe("3d");
  expect(formatNoticeTime(new Date(2026, 10, 18, 12, 0).getTime(), now)).toBe("Nov 18");
  expect(formatNoticeTime(new Date(2025, 11, 30, 12, 0).getTime(), now)).toBe("Dec 30, 2025");
});
