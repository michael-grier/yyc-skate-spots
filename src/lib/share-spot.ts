import { publicSiteUrl } from "@/lib/public-site";

/** Builds the public Universal Link shared for one spot. */
export function spotShareUrl(
  spotId: string,
  baseUrl = process.env.EXPO_PUBLIC_SHARE_BASE_URL,
): string {
  const url = new URL(publicSiteUrl("share", baseUrl));
  url.searchParams.set("id", spotId);
  return url.toString();
}
