import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { ClusterMarker } from "@/components/cluster-marker";
import { SpotMarker } from "@/components/spot-marker";
import { useClusters } from "@/lib/use-clusters";
import { darkMapStyle } from "@/theme/map-style";

// Downtown Calgary, framed wide enough to take in the whole city. Spots are
// scattered city-wide, so opening tighter than this hides most of them.
const CALGARY_REGION: Region = {
  latitude: 51.0447,
  longitude: -114.0719,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

// Shared empty result so the loading state doesn't churn memoized clusters.
const NO_SPOTS: never[] = [];

/**
 * The map is the app's landing screen and is browsable signed out. Sign-in is
 * only required for actions that write.
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  // undefined while the first result is in flight; the map renders empty.
  const spots = useQuery(api.spots.list) ?? NO_SPOTS;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Tracked on gesture end rather than every frame; clusters only need to
  // recompute once the map settles.
  const [region, setRegion] = useState(CALGARY_REGION);

  // Stable between renders so useClusters only rebuilds its index when the
  // query result actually changes.
  const points = useMemo(
    () => spots.map(({ _id, latitude, longitude }) => ({ id: _id, latitude, longitude })),
    [spots],
  );
  const { items, regionToExpand } = useClusters(points, region);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      initialRegion={CALGARY_REGION}
      customMapStyle={darkMapStyle}
      style={styles.map}
      onRegionChangeComplete={setRegion}
      onPress={() => setSelectedId(null)}
    >
      {items.map((item) =>
        item.kind === "cluster" ? (
          <ClusterMarker
            key={`cluster-${item.id}`}
            {...item}
            onPress={() => mapRef.current?.animateToRegion(regionToExpand(item), 300)}
          />
        ) : (
          <SpotMarker
            key={item.id}
            {...item}
            selected={item.id === selectedId}
            onPress={setSelectedId}
          />
        ),
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
