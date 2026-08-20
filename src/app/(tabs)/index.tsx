import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { ClusterMarker } from "@/components/cluster-marker";
import { LocateIcon } from "@/components/icons";
import { SpotMarker } from "@/components/spot-marker";
import { SpotPreviewCard } from "@/components/spot-preview-card";
import { distanceKm } from "@/lib/geo";
import { useClusters } from "@/lib/use-clusters";
import { useUserLocation } from "@/lib/use-user-location";
import { colors } from "@/theme/colors";
import { darkMapStyle } from "@/theme/map-style";

// Downtown Calgary, framed wide enough to take in the whole city. Spots are
// scattered city-wide, so opening tighter than this hides most of them.
const CALGARY_REGION: Region = {
  latitude: 51.0447,
  longitude: -114.0719,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

// Neighbourhood-scale framing used when jumping to the user's position.
const LOCATE_DELTA = 0.03;

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
  const { coords, granted, locate } = useUserLocation();

  // Stable between renders so useClusters only rebuilds its index when the
  // query result actually changes.
  const points = useMemo(
    () => spots.map(({ _id, latitude, longitude }) => ({ id: _id, latitude, longitude })),
    [spots],
  );
  const { items, regionToExpand } = useClusters(points, region);
  const selectedSpot = spots.find((spot) => spot._id === selectedId);

  async function handleLocate() {
    const position = await locate();
    if (position) {
      mapRef.current?.animateToRegion(
        { ...position, latitudeDelta: LOCATE_DELTA, longitudeDelta: LOCATE_DELTA },
        400,
      );
    }
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={CALGARY_REGION}
        customMapStyle={darkMapStyle}
        style={styles.map}
        showsUserLocation={granted}
        showsMyLocationButton={false}
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

      <View className="absolute inset-x-4 bottom-4 gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show my location"
          onPress={handleLocate}
          className="h-11 w-11 items-center justify-center self-end rounded-full border border-white/10 active:opacity-80"
          style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
        >
          <LocateIcon size={18} color={colors.ink} />
        </Pressable>
        {selectedSpot ? (
          <SpotPreviewCard
            name={selectedSpot.name}
            types={selectedSpot.types}
            bustFactor={selectedSpot.bustFactor}
            previewPhotoUrl={selectedSpot.previewPhotoUrl}
            distanceKm={coords ? distanceKm(coords, selectedSpot) : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
