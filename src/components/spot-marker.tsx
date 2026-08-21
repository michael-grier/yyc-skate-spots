import { View } from "react-native";
import { Marker } from "react-native-maps";

import { BoardMark } from "@/components/board-mark";
import { colors } from "@/theme/colors";

type SpotMarkerProps = {
  id: string;
  latitude: number;
  longitude: number;
  selected: boolean;
  /** The signed-in user's own spot: drawn dark-on-light inverted so it stands out. */
  mine?: boolean;
  onPress: (id: string) => void;
};

/**
 * A spot on the map: the board glyph in a matte disc; the selected spot
 * flips to the one bright element on the map.
 */
export function SpotMarker({ id, latitude, longitude, selected, mine, onPress }: SpotMarkerProps) {
  const fill = mine ? colors.card : colors.pinSelected;
  const glyph = mine ? colors.ink : colors.pinSelectedInk;
  return (
    <Marker
      // Custom marker views are rasterized once (tracksViewChanges off) for
      // scroll performance, so remount on a look change to capture it.
      key={`${id}-${selected ? "selected" : "idle"}-${mine ? "mine" : "theirs"}`}
      identifier={id}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={(event) => {
        // With the Google provider on iOS a marker tap also fires the map's
        // onPress, which would clear the selection this tap just made.
        event.stopPropagation();
        onPress(id);
      }}
    >
      {selected ? (
        <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white/15">
          <View
            className="h-10 w-10 items-center justify-center rounded-full border border-white/40"
            style={{ backgroundColor: fill }}
          >
            <BoardMark size={17} strokeWidth={2.4} color={glyph} />
          </View>
        </View>
      ) : (
        // Light on the dark map so pins read at a glance; the selected one
        // is the same colour but larger with a halo.
        <View
          className={`h-8 w-8 items-center justify-center rounded-full border ${mine ? "border-white/40" : "border-black/20"}`}
          style={{ backgroundColor: fill }}
        >
          <BoardMark size={14} strokeWidth={2.4} color={glyph} />
        </View>
      )}
    </Marker>
  );
}
