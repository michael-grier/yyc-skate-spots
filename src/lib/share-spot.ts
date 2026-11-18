import type { LatLng } from "@/lib/geo";
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

/**
 * What a private spot shares instead: a maps pin that opens for anyone, since
 * the listing itself is served only to its owner.
 */
export function mapPinUrl({ latitude, longitude }: LatLng) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
