import { Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { BoardMark } from "@/components/board-mark";
import { colors } from "@/theme/colors";

type SpotMarkerProps = {
  id: string;
  latitude: number;
  longitude: number;
  selected: boolean;
  /** The signed-in user's own spot: marked with a neon ring so it stands out. */
  mine?: boolean;
  /** Name shown under the disc, used while a search is active. */
  label?: string;
  onPress: (id: string) => void;
};

// Disc sizes and the label row height, used to keep the marker anchored on
// the disc's centre whether or not a label is rendered beneath it.
const DISC = { idle: 32, selected: 52 };
const LABEL_HEIGHT = 22;

/**
 * A spot on the map: the board glyph in a light disc. Selection adds a halo,
 * while the signed-in user's spots get a neon ring.
 */
export function SpotMarker({
  id,
  latitude,
  longitude,
  selected,
  mine,
  label,
  onPress,
}: SpotMarkerProps) {
  const fill = mine ? colors.pinMine : colors.pinSelected;
  const ringColor = mine
    ? colors.pinMineRing
    : selected
      ? "rgba(255,255,255,0.4)"
      : "rgba(0,0,0,0.2)";
  const disc = selected ? DISC.selected : DISC.idle;
  const anchorY = label ? disc / 2 / (disc + LABEL_HEIGHT) : 0.5;
  return (
    <Marker
      // Custom marker views are rasterized once (tracksViewChanges off) for
      // scroll performance, so remount on a look change to capture it.
      key={`${id}-${selected ? "selected" : "idle"}-${mine ? "mine" : "theirs"}-${label ?? ""}`}
      identifier={id}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: anchorY }}
      tracksViewChanges={false}
      onPress={(event) => {
        // With the Google provider on iOS a marker tap also fires the map's
        // onPress, which would clear the selection this tap just made.
        event.stopPropagation();
        onPress(id);
      }}
    >
      <View className="items-center">
        {selected ? (
          <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white/15">
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: fill, borderColor: ringColor, borderWidth: mine ? 2 : 1 }}
            >
              <BoardMark size={17} strokeWidth={2.4} color={colors.pinSelectedInk} />
            </View>
          </View>
        ) : (
          // Light on the dark map so pins read at a glance; the selected one
          // is the same colour but larger with a halo.
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: fill, borderColor: ringColor, borderWidth: mine ? 2 : 1 }}
          >
            <BoardMark size={14} strokeWidth={2.4} color={colors.pinSelectedInk} />
          </View>
        )}
        {label ? (
          <View
            className="mt-1 rounded-full border border-white/10 px-2 py-0.5"
            style={{ backgroundColor: "rgba(30,32,36,0.92)", height: LABEL_HEIGHT - 4 }}
          >
            <Text numberOfLines={1} className="font-sans-medium text-[11px] text-ink">
              {label}
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}
