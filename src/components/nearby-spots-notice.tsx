import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { Text } from "react-native";

import { Card } from "@/components/ui/card";
import { type LatLng, formatDistance } from "@/lib/geo";
import { DUPLICATE_RADIUS_M, findNearbySpots } from "@/lib/nearby-spots";

const NO_SPOTS: never[] = [];

/**
 * Warns before a likely duplicate is submitted. Checks published spots and the contributor's own
 * spots; other contributors' pending submissions stay private.
 */
export function NearbySpotsNotice({
  location,
  excludeId,
}: {
  location: LatLng | null;
  excludeId?: string;
}) {
  const published = useQuery(api.spots.list) ?? NO_SPOTS;
  const mine = useQuery(api.spots.mine) ?? NO_SPOTS;
  const nearby = useMemo(() => {
    if (!location) return [];
    const ownSpots = mine.filter((spot) => spot.status !== "removed");
    return findNearbySpots(location, [...published, ...ownSpots], excludeId);
  }, [location, published, mine, excludeId]);

  if (nearby.length === 0) return null;
  return (
    <Card accessibilityRole="alert" className="mt-3 border-bust-medium/40 p-4">
      <Text className="font-sans-semibold text-[14px] text-ink">Already on the map?</Text>
      <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
        {nearby.length === 1 ? "This spot is" : "These spots are"} within {DUPLICATE_RADIUS_M} m:
      </Text>
      {nearby.map((spot) => (
        <Text key={spot._id} className="mt-1 font-sans-medium text-[13px] text-silver">
          {spot.name} · {formatDistance(spot.distanceM / 1000)}
        </Text>
      ))}
      <Text className="mt-2 font-sans text-[13px] leading-relaxed text-mute">
        Duplicate spots are removed and count against your account. If this is a different spot, you
        can continue.
      </Text>
    </Card>
  );
}
