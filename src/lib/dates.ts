const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun ’26" — compact byline date, locale-independent. */
export function formatMonthYear(timestampMs: number) {
  const date = new Date(timestampMs);
  return `${MONTHS[date.getMonth()]} ’${String(date.getFullYear()).slice(-2)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "5m", "2h", "Yesterday", "3d", "Nov 18" — an update's age, by calendar day once past a day. */
export function formatNoticeTime(timestampMs: number, nowMs: number) {
  const elapsed = nowMs - timestampMs;
  if (elapsed < HOUR) {
    return `${Math.max(1, Math.floor(elapsed / MINUTE))}m`;
  }
  const date = new Date(timestampMs);
  const now = new Date(nowMs);
  // Local calendar dates keyed in UTC, so a 23- or 25-hour clock-change day still counts as one.
  const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  const daysAgo = dayNumber(now) - dayNumber(date);
  // A 25-hour fall-back day can put more than 24 hours between two times on the same date.
  if (elapsed < DAY || daysAgo === 0) {
    return `${Math.floor(elapsed / HOUR)}h`;
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  if (daysAgo < 7) {
    return `${daysAgo}d`;
  }
  const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}
