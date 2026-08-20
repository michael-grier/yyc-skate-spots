import { View } from "react-native";

import { ChevronDownIcon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { BUST_FACTOR_LABELS, SPOT_TYPE_LABELS } from "@/lib/spot-labels";
import type { SpotFilters } from "@/lib/spot-filters";
import { colors } from "@/theme/colors";

export type FilterSection = "distance" | "types" | "bust";

type FilterChipsProps = {
  filters: SpotFilters;
  onOpen: (section: FilterSection) => void;
};

function typesLabel(types: SpotFilters["types"]) {
  if (types.length === 0) return "All types";
  if (types.length === 1) return SPOT_TYPE_LABELS[types[0]];
  return `${types.length} types`;
}

function bustLabel(bustFactors: SpotFilters["bustFactors"]) {
  if (bustFactors.length === 0) return "Any bust";
  return bustFactors.map((b) => BUST_FACTOR_LABELS[b]).join(" · ");
}

/** The three always-visible filter chips; each opens the filter sheet. */
export function FilterChips({ filters, onOpen }: FilterChipsProps) {
  const chevron = (active: boolean) => (
    <ChevronDownIcon size={12} color={active ? colors.ink : colors.mute} />
  );
  const distanceActive = filters.maxDistanceKm !== null;
  const typesActive = filters.types.length > 0;
  const bustActive = filters.bustFactors.length > 0;

  return (
    <View className="flex-row gap-2">
      <Chip
        label={distanceActive ? `≤ ${filters.maxDistanceKm} km` : "Any distance"}
        selected={distanceActive}
        trailing={chevron(distanceActive)}
        onPress={() => onOpen("distance")}
        className="bg-[rgba(30,32,36,0.92)]"
      />
      <Chip
        label={typesLabel(filters.types)}
        selected={typesActive}
        trailing={chevron(typesActive)}
        onPress={() => onOpen("types")}
        className="bg-[rgba(30,32,36,0.92)]"
      />
      <Chip
        label={bustLabel(filters.bustFactors)}
        selected={bustActive}
        trailing={chevron(bustActive)}
        onPress={() => onOpen("bust")}
        className="bg-[rgba(30,32,36,0.92)]"
      />
    </View>
  );
}
