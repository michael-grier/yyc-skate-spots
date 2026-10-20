import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon, LockIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
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
  /** Replaces the "Your spot" note: private implies yours. */
  isPrivate?: boolean;
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
  isPrivate,
  onPress,
}: SpotPreviewCardProps) {
  const subtitle = [
    isPrivate ? "Private" : mine && "Your spot",
    formatSpotTypes(types),
    distanceKm !== undefined && `${formatDistance(distanceKm)} away`,
  ]
    .filter(Boolean)
    .join(" · ");

  const card = (
    <Card
      className={cn(
        "flex-row items-center gap-3 rounded-3xl py-3",
        previewPhotoUrl ? "px-3" : "px-5",
      )}
      style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
    >
      {previewPhotoUrl ? (
        <Image
          source={{ uri: previewPhotoUrl }}
          contentFit="cover"
          // Expo Image has no NativeWind mapping here; className leaves it without dimensions.
          style={{ width: 72, height: 72, borderRadius: 14 }}
        />
      ) : null}
      <View className="flex-1">
        <Text numberOfLines={1} className="font-sans-semibold text-[15px] text-ink">
          {name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          {isPrivate ? <LockIcon size={12} color={colors.mute} /> : null}
          <Text numberOfLines={1} className="flex-shrink font-sans text-[13px] text-mute">
            {subtitle}
          </Text>
        </View>
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
