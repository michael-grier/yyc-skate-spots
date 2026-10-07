import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appVariant } from "@/lib/env";
import { colors } from "@/theme/colors";

const LABELS = {
  development: "DEV · DEVELOPMENT DATA",
  preview: "PREVIEW · LIVE DATA",
};

/**
 * Names a non-store build and its backend from every screen. Rendered once
 * above the root stack and pinned into the bottom safe-area inset, which the
 * tab bar pads but leaves empty, so it never covers a control.
 */
export function BuildVariantBadge() {
  const insets = useSafeAreaInsets();
  if (appVariant === "production") {
    return null;
  }
  const color = colors.variant[appVariant];

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 bottom-0 items-center justify-center"
      // Devices without a home-indicator inset get a strip just tall enough for the pill.
      style={{ height: Math.max(insets.bottom, 16) }}
    >
      <View
        className="rounded-full border px-2"
        style={{ backgroundColor: `${color}26`, borderColor: `${color}55` }}
      >
        <Text className="font-sans-bold text-[9px] tracking-[0.7px]" style={{ color }}>
          {LABELS[appVariant]}
        </Text>
      </View>
    </View>
  );
}
