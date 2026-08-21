import { Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { colors } from "@/theme/colors";

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
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <View
        className="h-9 min-w-9 items-center justify-center rounded-full border border-black/20 px-2"
        style={{ backgroundColor: colors.pinSelected }}
      >
        <Text className="font-sans-semibold text-[12px]" style={{ color: colors.pinSelectedInk }}>
          {count}
        </Text>
      </View>
    </Marker>
  );
}
