import { View } from "react-native";
import { Marker } from "react-native-maps";

import { BoardMark } from "@/components/board-mark";
import { colors } from "@/theme/colors";

type SpotMarkerProps = {
  id: string;
  latitude: number;
  longitude: number;
  selected: boolean;
  onPress: (id: string) => void;
};

/**
 * A spot on the map: the board glyph in a matte disc; the selected spot
 * flips to the one bright element on the map.
 */
export function SpotMarker({ id, latitude, longitude, selected, onPress }: SpotMarkerProps) {
  return (
    <Marker
      // Custom marker views are rasterized once (tracksViewChanges off) for
      // scroll performance, so remount on selection to capture the new look.
      key={`${id}-${selected ? "selected" : "idle"}`}
      identifier={id}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={() => onPress(id)}
    >
      {selected ? (
        <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white/10">
          <View
            className="h-10 w-10 items-center justify-center rounded-full border border-white/30"
            style={{ backgroundColor: colors.pinSelected }}
          >
            <BoardMark size={17} strokeWidth={2.4} color={colors.pinSelectedInk} />
          </View>
        </View>
      ) : (
        <View
          className="h-8 w-8 items-center justify-center rounded-full border border-white/20"
          style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
        >
          <BoardMark size={14} strokeWidth={2.4} />
        </View>
      )}
    </Marker>
  );
}
