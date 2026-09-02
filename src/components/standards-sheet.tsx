import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import type { Ref } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { renderSheetBackdrop } from "@/components/ui/sheet-backdrop";
import { SPOT_STANDARDS } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

/** The one line that replaces the old standards card, sitting where saving happens. */
export function StandardsLine({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Read the spot standards"
      onPress={onPress}
      className="active:opacity-80"
    >
      <Text className="font-sans text-[12px] leading-[18px] text-mute">
        Every submission must be a real, accurate, shareable spot.{" "}
        <Text className="font-sans-semibold text-silver">Spot standards</Text>
      </Text>
    </Pressable>
  );
}

/**
 * The standards as a reminder rather than a wall at the top of the form: titles
 * only, with the full policy one tap away.
 */
export function StandardsSheet({
  ref,
  onReadFullStandards,
}: {
  ref: Ref<BottomSheetModal>;
  onReadFullStandards: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderSheetBackdrop}
      backgroundStyle={{
        backgroundColor: colors.base,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.18)", width: 40 }}
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
        <Text className="font-sans-semibold text-[18px] text-ink">Keep the map useful</Text>
        <Text className="mt-1.5 font-sans text-[13px] leading-relaxed text-mute">
          Only submit real, accurate, shareable skate spots. Every listing should meet all of these.
        </Text>
        <View className="mt-4 gap-3">
          {SPOT_STANDARDS.map((standard) => (
            <View key={standard.title} className="flex-row gap-2.5">
              <Text className="font-sans-semibold text-[13px] text-bust-low">✓</Text>
              <Text className="flex-1 font-sans text-[13px] leading-[18px] text-ink">
                {standard.title}
              </Text>
            </View>
          ))}
        </View>
        <Button label="Read the full standards" onPress={onReadFullStandards} className="mt-5" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
