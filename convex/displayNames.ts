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

/** Provider and legacy names must never turn an email fallback into a public byline. */
export function publicDisplayName(value: string | undefined | null) {
  const name = value?.trim();
  return name && !name.includes("@") && !/[\p{C}]/u.test(name) ? name : undefined;
}
