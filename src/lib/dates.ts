const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun ’26" — compact byline date, locale-independent. */
export function formatMonthYear(timestampMs: number) {
  const date = new Date(timestampMs);
  return `${MONTHS[date.getMonth()]} ’${String(date.getFullYear()).slice(-2)}`;
}
