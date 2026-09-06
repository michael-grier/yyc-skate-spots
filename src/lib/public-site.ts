export type PublicSitePage = "privacy" | "share" | "standards" | "support";

/** Builds one URL at the HTTPS origin shared by public pages and Universal Links. */
export function publicSiteUrl(
  page: PublicSitePage,
  baseUrl = process.env.EXPO_PUBLIC_SHARE_BASE_URL,
): string {
  if (!baseUrl) {
    throw new Error("The public website is not configured in this build.");
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

  return new URL(`/${page}`, origin).toString();
}
