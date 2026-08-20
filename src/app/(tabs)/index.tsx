import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

import { SpotMarker } from "@/components/spot-marker";
import { darkMapStyle } from "@/theme/map-style";

// Downtown Calgary, framed wide enough to take in the whole city. Spots are
// scattered city-wide, so opening tighter than this hides most of them.
const CALGARY_REGION = {
  latitude: 51.0447,
  longitude: -114.0719,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

/**
 * The map is the app's landing screen and is browsable signed out. Sign-in is
 * only required for actions that write.
 */
export default function MapScreen() {
  // undefined while the first result is in flight; the map renders empty.
  const spots = useQuery(api.spots.list) ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      initialRegion={CALGARY_REGION}
      customMapStyle={darkMapStyle}
      style={styles.map}
      onPress={() => setSelectedId(null)}
    >
      {spots.map((spot) => (
        <SpotMarker
          key={spot._id}
          id={spot._id}
          latitude={spot.latitude}
          longitude={spot.longitude}
          selected={spot._id === selectedId}
          onPress={setSelectedId}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
