import { api } from "@convex/_generated/api";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import { DuplicateSpotSheet } from "@/components/duplicate-spot-sheet";
import type { LatLng } from "@/lib/geo";
import { type NearbySpot, findNearbySpots } from "@/lib/nearby-spots";

type Prompt = { nearby: NearbySpot[]; open: boolean; answer: (proceed: boolean) => void };

// Convex waits out a lost connection instead of failing, so cap the wait for an answer.
const CHECK_TIMEOUT_MS = 10_000;

function withTimeout<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timed out")), CHECK_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

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
  const checking = useRef(false);
  // Kept after closing so the sheet's content stays in place while it slides away.
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  async function confirmNotDuplicate(location: LatLng) {
    const pin = `${location.latitude},${location.longitude}`;
    if (confirmedPin.current === pin) return true;
    // A repeated tap while a check or its sheet is open is ignored; the open check still answers.
    if (checking.current) return false;
    checking.current = true;
    try {
      return await checkPin(location, pin);
    } finally {
      checking.current = false;
    }
  }

  async function checkPin(location: LatLng, pin: string) {
    let nearby: NearbySpot[];
    try {
      // Fetched on demand so a subscription that is still loading cannot skip the check.
      const [published, mine] = await withTimeout(
        Promise.all([convex.query(api.spots.list, {}), convex.query(api.spots.mine, {})]),
      );
      const ownSpots = mine.filter((spot) => spot.status !== "removed");
      nearby = findNearbySpots(location, [...published, ...ownSpots], excludeId);
    } catch {
      // Stay put; tapping Next or Save again retries the check.
      Alert.alert("Couldn't check for nearby spots", "Check your connection and try again.");
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
