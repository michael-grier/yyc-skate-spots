import * as Location from "expo-location";
import { useEffect, useState } from "react";

type Lookup = { key: string; address: string | null };

/**
 * Best-effort "street, district" for a spot via reverse geocoding. Android
 * needs location permission for geocoding, so callers pass `enabled` only
 * when that's already granted (iOS: always). Failures just leave it null.
 */
export function useSpotAddress(
  latitude: number | undefined,
  longitude: number | undefined,
  enabled: boolean,
) {
  // The result is keyed by the coordinates it was looked up for, so a change
  // of spot yields null (not the previous address) until its lookup lands.
  const key =
    enabled && latitude !== undefined && longitude !== undefined
      ? `${latitude},${longitude}`
      : null;
  const [lookup, setLookup] = useState<Lookup | null>(null);

  useEffect(() => {
    if (key === null || latitude === undefined || longitude === undefined) {
      return;
    }
    let cancelled = false;
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then(([first]) => {
        if (cancelled) {
          return;
        }
        const parts = first ? [first.street, first.district ?? first.city].filter(Boolean) : [];
        setLookup({ key, address: parts.length > 0 ? parts.join(", ") : null });
      })
      .catch(() => {
        // Geocoder unavailable: the detail screen simply omits the subtitle.
      });
    return () => {
      cancelled = true;
    };
  }, [key, latitude, longitude]);

  return lookup?.key === key ? lookup.address : null;
}
