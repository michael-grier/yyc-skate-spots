/** Joins conditional className fragments, dropping falsy entries. */
export function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}
