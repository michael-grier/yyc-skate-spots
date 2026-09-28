import { api } from "@convex/_generated/api";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Alert, type AlertButton, Platform } from "react-native";

import { type LatLng, formatDistance } from "@/lib/geo";
import { DUPLICATE_RADIUS_M, findNearbySpots } from "@/lib/nearby-spots";

// Android alerts show at most three buttons, leaving room for one View beside the two choices.
const MAX_VIEW_BUTTONS = Platform.OS === "android" ? 1 : 3;

/**
 * Returns a check that asks before a pin lands near an existing spot, resolving true to continue.
 * Spots rarely have one agreed name, so nearby spots get View buttons to compare photos. Checks
 * published spots and the contributor's own; other contributors' pending spots stay private.
 * Once the contributor says a pin is a different spot, that pin is not asked about again.
 */
export function useDuplicateCheck(excludeId?: string) {
  const convex = useConvex();
  const router = useRouter();
  const confirmedPin = useRef<string | null>(null);

  return async (location: LatLng) => {
    const pin = `${location.latitude},${location.longitude}`;
    if (confirmedPin.current === pin) return true;
    let nearby: ReturnType<typeof findNearbySpots>;
    try {
      // Fetched on demand so a subscription that is still loading cannot skip the check.
      const [published, mine] = await Promise.all([
        convex.query(api.spots.list, {}),
        convex.query(api.spots.mine, {}),
      ]);
      const ownSpots = mine.filter((spot) => spot.status !== "removed");
      nearby = findNearbySpots(location, [...published, ...ownSpots], excludeId);
    } catch {
      // Convex queries wait out a lost connection, so a failure is a server error. Stay put;
      // tapping Next or Save again retries the check.
      Alert.alert("Couldn't check for nearby spots", "Try again in a moment.");
      return false;
    }
    if (nearby.length === 0) return true;

    const list = nearby
      .map((spot) => `${spot.name} (${formatDistance(spot.distanceM / 1000)})`)
      .join("\n");
    return await new Promise<boolean>((resolve) => {
      const viewButtons: AlertButton[] = nearby.slice(0, MAX_VIEW_BUTTONS).map((spot) => ({
        text: `View ${spot.name}`,
        onPress: () => {
          resolve(false);
          router.push({ pathname: "/spot/[id]", params: { id: spot._id } });
        },
      }));
      Alert.alert(
        "Already on the map?",
        `Within ${DUPLICATE_RADIUS_M} m of this pin:\n${list}\n\nDuplicate spots are removed and count against your account.`,
        [
          ...viewButtons,
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
  };
}
