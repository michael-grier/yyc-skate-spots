import * as Location from "expo-location";
import { useEffect, useState } from "react";

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
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // Never show the previous coordinates' address while a new lookup runs.
    setAddress(null);
    if (!enabled || latitude === undefined || longitude === undefined) {
      return;
    }
    let cancelled = false;
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then(([first]) => {
        if (cancelled || !first) {
          return;
        }
        const parts = [first.street, first.district ?? first.city].filter(Boolean);
        setAddress(parts.length > 0 ? parts.join(", ") : null);
      })
      .catch(() => {
        // Geocoder unavailable: the detail screen simply omits the subtitle.
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, enabled]);

  return address;
}
