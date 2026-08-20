import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { LatLng } from "@/lib/geo";

/**
 * The user's position for distances and the locate button. Reads silently
 * when permission was already granted; `locate()` prompts otherwise, so the
 * system dialog only appears in response to a tap.
 */
export function useUserLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [granted, setGranted] = useState(false);

  const readPosition = useCallback(async () => {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    setCoords(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled || !permission.granted) {
        return;
      }
      setGranted(true);
      await readPosition();
    })().catch(() => {
      // Location services off or unavailable: the map simply has no blue dot.
    });
    return () => {
      cancelled = true;
    };
  }, [readPosition]);

  /** Prompts if needed, then resolves the position (null if denied). */
  const locate = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    setGranted(permission.granted);
    if (!permission.granted) {
      return null;
    }
    return await readPosition().catch(() => null);
  }, [readPosition]);

  return { coords, granted, locate };
}
