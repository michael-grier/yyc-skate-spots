import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import type { Ref } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { renderSheetBackdrop } from "@/components/ui/sheet-backdrop";
import {
  DISTANCE_PRESETS_KM,
  type SpotFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
} from "@/lib/spot-filters";
import {
  BUST_FACTOR_COLORS,
  BUST_FACTOR_LABELS,
  BUST_FACTORS,
  SPOT_TYPE_LABELS,
  SPOT_TYPES,
} from "@/lib/spot-labels";
import { toggle } from "@/lib/toggle";
import { colors } from "@/theme/colors";

type FilterSheetProps = {
  ref: Ref<BottomSheetModal>;
  filters: SpotFilters;
  /** Applied live, so the map underneath updates as options are tapped. */
  onChange: (filters: SpotFilters) => void;
  resultCount: number;
  hasLocation: boolean;
  onRequestLocation: () => void;
  onDone: () => void;
};

function SectionLabel({ children }: { children: string }) {
  return <Text className="mt-6 font-sans-medium text-[11px] text-mute">{children}</Text>;
}

/** All three filters in one sheet; any chip on the map opens it. */
export function FilterSheet({
  ref,
  filters,
  onChange,
  resultCount,
  hasLocation,
  onRequestLocation,
  onDone,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const activeCount = countActiveFilters(filters);

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
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-semibold text-[18px] text-ink">Filters</Text>
          {activeCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onChange({ ...DEFAULT_FILTERS, query: filters.query })}
            >
              <Text className="font-sans text-[13px] text-mute">Reset</Text>
            </Pressable>
          ) : null}
        </View>

        <SectionLabel>DISTANCE</SectionLabel>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Chip
            label="Any"
            selected={filters.maxDistanceKm === null}
            onPress={() => onChange({ ...filters, maxDistanceKm: null })}
          />
          {DISTANCE_PRESETS_KM.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={filters.maxDistanceKm === km}
              onPress={() => onChange({ ...filters, maxDistanceKm: km })}
            />
          ))}
        </View>
        {!hasLocation ? (
          <Pressable accessibilityRole="button" onPress={onRequestLocation} className="mt-2">
            <Text className="font-sans text-[12px] text-mute">
              Distance needs your location — <Text className="text-silver">turn it on</Text>
            </Text>
          </Pressable>
        ) : null}

        <SectionLabel>TYPES</SectionLabel>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {SPOT_TYPES.map((type) => (
            <Chip
              key={type}
              label={SPOT_TYPE_LABELS[type]}
              selected={filters.types.includes(type)}
              onPress={() => onChange({ ...filters, types: toggle(filters.types, type) })}
            />
          ))}
        </View>

        <SectionLabel>BUST FACTOR</SectionLabel>
        <View className="mt-2 flex-row gap-2">
          {BUST_FACTORS.map((bust) => (
            <Chip
              key={bust}
              label={BUST_FACTOR_LABELS[bust]}
              dotColor={BUST_FACTOR_COLORS[bust]}
              selected={filters.bustFactors.includes(bust)}
              onPress={() =>
                onChange({ ...filters, bustFactors: toggle(filters.bustFactors, bust) })
              }
              className="flex-1"
            />
          ))}
        </View>

        <Button
          label={`Show ${resultCount} ${resultCount === 1 ? "spot" : "spots"}`}
          onPress={onDone}
          className="mt-7"
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
