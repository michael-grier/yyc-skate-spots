/** Joins conditional className fragments, dropping falsy entries. */
export function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
