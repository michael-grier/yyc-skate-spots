import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Alert } from "react-native";

import { type LatLng, formatDistance } from "@/lib/geo";
import { DUPLICATE_RADIUS_M, findNearbySpots } from "@/lib/nearby-spots";

/**
 * Returns a check that asks before a pin lands near an existing spot, resolving true to continue.
 * Spots rarely have one agreed name, so each nearby spot gets a View button to compare photos.
 * Checks published spots and the contributor's own; other contributors' pending spots stay
 * private. Once the contributor says a pin is a different spot, that pin is not asked about again.
 */
export function useDuplicateCheck(excludeId?: string) {
  const router = useRouter();
  const published = useQuery(api.spots.list);
  const mine = useQuery(api.spots.mine);
  const confirmedPin = useRef<string | null>(null);

  return (location: LatLng) =>
    new Promise<boolean>((resolve) => {
      const pin = `${location.latitude},${location.longitude}`;
      const ownSpots = (mine ?? []).filter((spot) => spot.status !== "removed");
      const nearby = findNearbySpots(location, [...(published ?? []), ...ownSpots], excludeId);
      if (nearby.length === 0 || confirmedPin.current === pin) {
        resolve(true);
        return;
      }
      Alert.alert(
        "Already on the map?",
        `${nearby.length === 1 ? "A spot is" : `${nearby.length} spots are`} within ${DUPLICATE_RADIUS_M} m of this pin. Duplicate spots are removed and count against your account.`,
        [
          ...nearby.map((spot) => ({
            text: `View ${spot.name} (${formatDistance(spot.distanceM / 1000)})`,
            onPress: () => {
              resolve(false);
              router.push({ pathname: "/spot/[id]", params: { id: spot._id } });
            },
          })),
          {
            text: "It's a different spot",
            onPress: () => {
              confirmedPin.current = pin;
              resolve(true);
            },
          },
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        ],
        // Android can dismiss by tapping outside; treat that as Cancel.
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
}
