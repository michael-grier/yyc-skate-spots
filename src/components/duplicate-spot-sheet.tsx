import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/geo";
import { DUPLICATE_RADIUS_M, type NearbySpot } from "@/lib/nearby-spots";
import { colors } from "@/theme/colors";

/** Asks the contributor to compare nearby spots before continuing with a possible duplicate. */
export function DuplicateSpotSheet({
  visible,
  nearby,
  onView,
  onContinue,
  onBack,
}: {
  visible: boolean;
  nearby: NearbySpot[];
  onView: (spotId: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      testID="duplicate-spot-sheet"
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onBack}
    >
      <View className="flex-1 justify-end bg-black/65">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          className="flex-1"
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onBack}
          className="rounded-t-[30px] border-t border-white/15 bg-card pt-3"
          style={{ maxHeight: "85%", paddingBottom: insets.bottom + 16 }}
        >
          <View className="mx-auto h-1 w-10 rounded-full bg-white/20" />
          {/* Scrolls on small phones or with large text so both choices stay reachable. */}
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
          >
            <Text
              accessibilityRole="header"
              className="font-sans-semibold text-[23px] tracking-tight text-ink"
            >
              Potential duplicate spot detected
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              Your spot is within {DUPLICATE_RADIUS_M} m of{" "}
              {nearby.length === 1 ? "this existing spot:" : "these existing spots:"}
            </Text>
            <View className="mt-3 gap-2">
              {nearby.map((spot) => (
                <Pressable
                  key={spot._id}
                  accessibilityRole="link"
                  accessibilityLabel={`View ${spot.name}, ${formatDistance(spot.distanceM / 1000)} away`}
                  onPress={() => onView(spot._id)}
                  className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-base px-4 py-3 active:opacity-80"
                >
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-[15px] text-ink">{spot.name}</Text>
                    <Text className="mt-0.5 font-sans text-[12px] text-mute">
                      {formatDistance(spot.distanceM / 1000)} away · View spot
                    </Text>
                  </View>
                  <ChevronRightIcon size={18} color={colors.mute} />
                </Pressable>
              ))}
            </View>
            <Text className="mt-4 font-sans text-[14px] leading-relaxed text-mute">
              Duplicate spots make the map more confusing and harder to use, so they may be removed
              by the admin team.
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              Please confirm your spot is a unique one before proceeding.
            </Text>
          </ScrollView>
          <View className="px-5">
            <Button
              label="My spot is unique"
              variant="light"
              onPress={onContinue}
              className="mt-5"
            />
            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              className="items-center py-4 active:opacity-80"
            >
              <Text className="font-sans-semibold text-[14px] text-silver">Go back</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
