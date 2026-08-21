import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { BoardMark } from "@/components/board-mark";
import { ChevronRightIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { formatDistance } from "@/lib/geo";
import {
  BUST_FACTOR_COLORS,
  BUST_FACTOR_LABELS,
  type BustFactor,
  type SpotType,
  formatSpotTypes,
} from "@/lib/spot-labels";
import { colors } from "@/theme/colors";

type SpotPreviewCardProps = {
  name: string;
  types: SpotType[];
  bustFactor: BustFactor;
  previewPhotoUrl: string | null;
  /** Omitted when the user's location is unknown. */
  distanceKm?: number;
  mine?: boolean;
  /** When absent the card is static: no chevron, no button semantics. */
  onPress?: () => void;
};

/** Summary card shown over the map for the selected pin. */
export function SpotPreviewCard({
  name,
  types,
  bustFactor,
  previewPhotoUrl,
  distanceKm,
  mine,
  onPress,
}: SpotPreviewCardProps) {
  const subtitle = [
    mine && "Your spot",
    formatSpotTypes(types),
    distanceKm !== undefined && `${formatDistance(distanceKm)} away`,
  ]
    .filter(Boolean)
    .join(" · ");

  const card = (
    <Card
      className="flex-row items-center gap-3 rounded-3xl p-3"
      style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
    >
      {previewPhotoUrl ? (
        <Image
          source={{ uri: previewPhotoUrl }}
          contentFit="cover"
          className="h-[72px] w-[72px] rounded-2xl"
        />
      ) : (
        <View className="h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white/5">
          <BoardMark size={28} color={colors.mute} />
        </View>
      )}
      <View className="flex-1">
        <Text numberOfLines={1} className="font-sans-semibold text-[15px] text-ink">
          {name}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 font-sans text-[13px] text-mute">
          {subtitle}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <View
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: BUST_FACTOR_COLORS[bustFactor] }}
          />
          <Text className="font-sans text-[12px] text-mute">
            {BUST_FACTOR_LABELS[bustFactor]} bust factor
          </Text>
        </View>
      </View>
      {onPress ? <ChevronRightIcon size={18} color={colors.mute} /> : null}
    </Card>
  );

  // Only a button when there is somewhere to go; otherwise a plain card so
  // assistive tech doesn't announce an action that does nothing.
  if (!onPress) {
    return card;
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="active:opacity-90">
      {card}
    </Pressable>
  );
}
