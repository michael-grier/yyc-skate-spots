import { Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { BoardMark } from "@/components/board-mark";
import { colors, mapColors } from "@/theme/colors";

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
const DISC = {
  mine: { idle: 36, selected: 56 },
  standard: { idle: 32, selected: 52 },
};
const LABEL_HEIGHT = 22;

type MarkerDiscProps = {
  mine: boolean;
  selected: boolean;
};

/** Marker face; owned spots add a graphite gap inside the neon ring. */
function MarkerDisc({ mine, selected }: MarkerDiscProps) {
  if (mine) {
    return (
      <View
        className={`${selected ? "h-11 w-11" : "h-9 w-9"} rounded-full p-0.5`}
        style={{ backgroundColor: colors.pinMineRing }}
      >
        <View className="flex-1 rounded-full p-0.5" style={{ backgroundColor: mapColors.land }}>
          <View
            className="flex-1 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.pinMine }}
          >
            <BoardMark size={selected ? 18 : 15} strokeWidth={2.4} color={colors.pinSelectedInk} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`${selected ? "h-10 w-10" : "h-8 w-8"} items-center justify-center rounded-full`}
      style={{
        backgroundColor: colors.pinSelected,
        borderColor: selected ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)",
        borderWidth: 1,
      }}
    >
      <BoardMark size={selected ? 17 : 14} strokeWidth={2.4} color={colors.pinSelectedInk} />
    </View>
  );
}

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
  const state = selected ? "selected" : "idle";
  const disc = (mine ? DISC.mine : DISC.standard)[state];
  const anchorY = label ? disc / 2 / (disc + LABEL_HEIGHT) : 0.5;
  return (
    <Marker
      // Custom marker views are rasterized once (tracksViewChanges off) for
      // scroll performance, so remount on a look change to capture it.
      key={`${id}-${state}-${mine ? "mine" : "theirs"}-${label ?? ""}`}
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
          <View
            className={`${mine ? "h-14 w-14" : "h-[52px] w-[52px]"} items-center justify-center rounded-full bg-white/15`}
          >
            <MarkerDisc mine={mine === true} selected />
          </View>
        ) : (
          <MarkerDisc mine={mine === true} selected={false} />
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
