export const DISPLAY_NAME_MAX_LENGTH = 40;
export const DISPLAY_NAME_HINT =
  "1–40 characters. Letters, numbers, spaces, apostrophes, hyphens and periods.";

/** NFC keeps accented names consistent; count Unicode characters rather than UTF-16 units. */
export function displayNameError(value: string) {
  const name = value.trim().normalize("NFC");
  if (Array.from(name).length < 1 || Array.from(name).length > DISPLAY_NAME_MAX_LENGTH) {
    return "Use 1–40 characters for your display name.";
  }
  if (!/^[\p{L}\p{M}\p{N} .'’\-]+$/u.test(name)) {
    return "Use letters, numbers, spaces, apostrophes, hyphens or periods.";
  }
  return null;
}

/**
 * A stable public name for accounts that never chose one. Deriving it from the identity lets
 * existing spots show it without a backfill. FNV-1a keeps it synchronous in Convex queries.
 */
export function anonymousDisplayName(userIdentifier: string) {
  let hash = 0x811c9dc5;
  for (const char of userIdentifier) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return `Anonymous Skater ${100000 + (hash % 900000)}`;
}

/** Provider and legacy names must never turn an email fallback into a public byline. */
export function publicDisplayName(value: string | undefined | null) {
  const name = value?.trim();
  return name && !name.includes("@") && !/[\p{C}]/u.test(name) ? name : undefined;
}
