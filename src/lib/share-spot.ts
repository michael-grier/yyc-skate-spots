/** Builds the public Universal Link shared for one spot. */
export function spotShareUrl(
  spotId: string,
  baseUrl = process.env.EXPO_PUBLIC_SHARE_BASE_URL,
): string {
  if (!baseUrl) {
    throw new Error("Spot sharing is not configured in this build.");
  }

  const origin = new URL(baseUrl);
  if (
    origin.protocol !== "https:" ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password ||
    origin.port
  ) {
    throw new Error("EXPO_PUBLIC_SHARE_BASE_URL must be an HTTPS origin without a path.");
  }

  const url = new URL("/share", origin);
  url.searchParams.set("id", spotId);
  return url.toString();
}
