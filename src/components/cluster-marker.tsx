import { Text, View } from "react-native";
import { Marker } from "react-native-maps";

type ClusterMarkerProps = {
  id: number;
  latitude: number;
  longitude: number;
  count: number;
  onPress: () => void;
};

/** Count bubble for a group of nearby spots; tapping zooms in to split it. */
export function ClusterMarker({ id, latitude, longitude, count, onPress }: ClusterMarkerProps) {
  return (
    <Marker
      key={`cluster-${id}-${count}`}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={onPress}
    >
      <View
        className="h-9 min-w-9 items-center justify-center rounded-full border border-white/20 px-2"
        style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
      >
        <Text className="font-sans-semibold text-[12px] text-ink">{count}</Text>
      </View>
    </Marker>
  );
}
