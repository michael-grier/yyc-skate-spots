import type { LatLng } from "@/lib/geo";

export type Destination = LatLng & { name: string };

/**
 * Directions deep link for a platform. On iOS, Google Maps when installed,
 * Apple Maps otherwise. On Android the universal Google Maps URL opens the
 * app when installed and the website when not, so no probe is needed.
 */
export function directionsUrl(
  platform: "ios" | "android",
  destination: Destination,
  googleMapsInstalled: boolean,
) {
  const { latitude, longitude, name } = destination;
  const coords = `${latitude},${longitude}`;
  if (platform === "ios") {
    return googleMapsInstalled
      ? `comgooglemaps://?daddr=${coords}`
      : `maps://?daddr=${coords}&q=${encodeURIComponent(name)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
}

/** Probed with Linking.canOpenURL; listed in LSApplicationQueriesSchemes. */
export const GOOGLE_MAPS_SCHEME = "comgooglemaps://";
