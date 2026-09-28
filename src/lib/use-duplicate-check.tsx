import { api } from "@convex/_generated/api";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import { DuplicateSpotSheet } from "@/components/duplicate-spot-sheet";
import type { LatLng } from "@/lib/geo";
import { type NearbySpot, findNearbySpots } from "@/lib/nearby-spots";

type Prompt = { nearby: NearbySpot[]; open: boolean; answer: (proceed: boolean) => void };

/**
 * Asks before a pin lands near an existing spot. `confirmNotDuplicate` resolves true to continue;
 * render `duplicateSheet` in the form. Spots rarely have one agreed name, so each nearby spot links
 * to its page for comparing photos. Checks published spots and the contributor's own; other
 * contributors' pending spots stay private. A pin confirmed as unique is not asked about again.
 */
export function useDuplicateCheck(excludeId?: string) {
  const convex = useConvex();
  const router = useRouter();
  const confirmedPin = useRef<string | null>(null);
  // Kept after closing so the sheet's content stays in place while it slides away.
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  async function confirmNotDuplicate(location: LatLng) {
    const pin = `${location.latitude},${location.longitude}`;
    if (confirmedPin.current === pin) return true;
    let nearby: NearbySpot[];
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

    return await new Promise<boolean>((resolve) => {
      setPrompt({
        nearby,
        open: true,
        answer: (proceed) => {
          if (proceed) confirmedPin.current = pin;
          setPrompt((current) => current && { ...current, open: false });
          resolve(proceed);
        },
      });
    });
  }

  const duplicateSheet = (
    <DuplicateSpotSheet
      visible={prompt?.open ?? false}
      nearby={prompt?.nearby ?? []}
      onView={(spotId) => {
        prompt?.answer(false);
        router.push({ pathname: "/spot/[id]", params: { id: spotId } });
      }}
      onContinue={() => prompt?.answer(true)}
      onBack={() => prompt?.answer(false)}
    />
  );

  return { confirmNotDuplicate, duplicateSheet };
}
