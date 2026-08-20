import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, NavigateIcon } from "@/components/icons";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Button } from "@/components/ui/button";
import { Hairline } from "@/components/ui/hairline";
import { formatMonthYear } from "@/lib/dates";
import { distanceKm, formatDistance } from "@/lib/geo";
import { openDirections } from "@/lib/open-directions";
import {
  BUST_FACTOR_COLORS,
  BUST_FACTOR_LABELS,
  SURFACE_LABELS,
  formatSpotTypes,
} from "@/lib/spot-labels";
import { useSpotAddress } from "@/lib/use-spot-address";
import { useUserLocation } from "@/lib/use-user-location";
import { colors } from "@/theme/colors";

type FactProps = { label: string; value: string; dotColor?: string; column: 0 | 1 };

/** One cell of the 2×2 hairline facts grid. */
function Fact({ label, value, dotColor, column }: FactProps) {
  return (
    <View
      className={`w-1/2 border-t border-white/10 py-3 ${column === 1 ? "border-l pl-4" : "pr-4"}`}
    >
      <Text className="font-sans text-[11px] text-mute">{label}</Text>
      <View className="mt-0.5 flex-row items-center gap-1.5">
        {dotColor ? (
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        ) : null}
        <Text
          className="font-sans-medium text-[14px] text-ink"
          style={dotColor ? { color: dotColor } : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const spot = useQuery(api.spots.get, { id: id as Id<"spots"> });
  const { coords, granted } = useUserLocation();
  // Android's geocoder needs location permission; iOS's does not.
  const address = useSpotAddress(spot?.latitude, spot?.longitude, Platform.OS === "ios" || granted);

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="absolute left-4 h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
      style={{ top: insets.top + 8, backgroundColor: "rgba(30,32,36,0.72)" }}
    >
      <BackIcon size={18} color={colors.ink} />
    </Pressable>
  );

  if (spot === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
        {backButton}
      </View>
    );
  }

  if (spot === null) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">This spot is gone</Text>
        <Text className="mt-2 text-center font-sans text-[14px] text-mute">
          It may have been removed by the person who added it.
        </Text>
        {backButton}
      </View>
    );
  }

  const byline = spot.createdByName
    ? `Added ${formatMonthYear(spot._creationTime)} by ${spot.createdByName}`
    : `Added ${formatMonthYear(spot._creationTime)}`;

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}>
        <PhotoCarousel urls={spot.photoUrls} spotName={spot.name} />

        <View className="px-5">
          <Text className="font-sans-semibold text-[26px] tracking-tight text-ink">
            {spot.name}
          </Text>
          {address ? <Text className="mt-1 font-sans text-[14px] text-mute">{address}</Text> : null}

          <View className="mt-4 flex-row flex-wrap">
            <Fact label="Type" value={formatSpotTypes(spot.types)} column={0} />
            <Fact
              label="Distance"
              value={coords ? formatDistance(distanceKm(coords, spot)) : "—"}
              column={1}
            />
            <Fact
              label="Bust factor"
              value={BUST_FACTOR_LABELS[spot.bustFactor]}
              dotColor={BUST_FACTOR_COLORS[spot.bustFactor]}
              column={0}
            />
            <Fact
              label="Surface"
              value={spot.surface ? SURFACE_LABELS[spot.surface] : "—"}
              column={1}
            />
          </View>
          <Hairline />

          {spot.notes ? (
            <Text className="mt-4 font-sans text-[15px] leading-relaxed text-ink/90">
              {spot.notes}
            </Text>
          ) : null}
          <Text className="mt-4 font-sans text-[12px] text-mute">{byline}</Text>
        </View>
      </ScrollView>

      {backButton}

      <View
        className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-base px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          label="Take Me There"
          icon={<NavigateIcon size={17} color={colors.ink} />}
          onPress={() => void openDirections(spot)}
        />
      </View>
    </View>
  );
}
