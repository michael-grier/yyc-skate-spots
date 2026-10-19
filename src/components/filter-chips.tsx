import { ScrollView } from "react-native";

import { CloseIcon, SlidersIcon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { BUST_FACTOR_LABELS, SPOT_TYPE_LABELS } from "@/lib/spot-labels";
import { type SpotFilters, countActiveFilters } from "@/lib/spot-filters";
import { colors } from "@/theme/colors";

type FilterChipsProps = {
  filters: SpotFilters;
  onOpen: () => void;
  onChange: (filters: SpotFilters) => void;
};

function typesLabel(types: SpotFilters["types"]) {
  if (types.length === 1) return SPOT_TYPE_LABELS[types[0]];
  return `${types.length} types`;
}

function bustLabel(bustFactors: SpotFilters["bustFactors"]) {
  if (bustFactors.length === 1) return `${BUST_FACTOR_LABELS[bustFactors[0]]} bust`;
  return `${bustFactors.length} bust levels`;
}

/** One pill per active filter; tapping a pill clears that filter. */
function activePills(filters: SpotFilters) {
  return [
    filters.maxDistanceKm !== null && {
      key: "distance",
      label: `≤ ${filters.maxDistanceKm} km`,
      cleared: { ...filters, maxDistanceKm: null },
    },
    filters.types.length > 0 && {
      key: "types",
      label: typesLabel(filters.types),
      cleared: { ...filters, types: [] },
    },
    filters.bustFactors.length > 0 && {
      key: "bust",
      label: bustLabel(filters.bustFactors),
      cleared: { ...filters, bustFactors: [] },
    },
    filters.hasPhotos && {
      key: "photos",
      label: "Has photos",
      cleared: { ...filters, hasPhotos: false },
    },
  ].filter((pill) => pill !== false);
}

/**
 * The Filters button that opens the sheet, followed by the active filters.
 * Scrolls sideways rather than wrapping so it never pushes onto a second line.
 */
export function FilterChips({ filters, onOpen, onChange }: FilterChipsProps) {
  const activeCount = countActiveFilters(filters);
  const active = activeCount > 0;

  return (
    // Bleeds to the screen edges so pills scroll out of view instead of
    // clipping at the overlay's inset.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className="-mx-4"
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      <Chip
        label={active ? `Filters · ${activeCount}` : "Filters"}
        selected={active}
        leading={<SlidersIcon size={14} color={active ? colors.ink : colors.mute} />}
        onPress={onOpen}
        className="bg-[rgba(30,32,36,0.92)]"
      />
      {activePills(filters).map(({ key, label, cleared }) => (
        <Chip
          key={key}
          label={label}
          selected
          trailing={<CloseIcon size={11} color={colors.ink} />}
          accessibilityLabel={`Remove ${label} filter`}
          onPress={() => onChange(cleared)}
          className="bg-[rgba(30,32,36,0.92)]"
        />
      ))}
    </ScrollView>
  );
}
