import type { ReactNode } from "react";
import { View } from "react-native";

type ChipGridProps<T> = {
  items: readonly T[];
  columns: number;
  keyOf: (item: T) => string;
  /** Render a chip with `w-full` so it fills its cell. */
  renderItem: (item: T) => ReactNode;
};

/**
 * Equal-width columns of chips, so options line up instead of wrapping into ragged rows. Every
 * cell, filled or empty, is the same unpadded flex box: a padded chip starts wider than an empty
 * cell, so a short final row would otherwise stretch its chips.
 */
export function ChipGrid<T>({ items, columns, keyOf, renderItem }: ChipGridProps<T>) {
  const rows = Array.from({ length: Math.ceil(items.length / columns) }, (_, row) =>
    items.slice(row * columns, row * columns + columns),
  );
  return (
    <View className="gap-2">
      {rows.map((row) => (
        <View key={keyOf(row[0])} className="flex-row gap-2">
          {row.map((item) => (
            <View key={keyOf(item)} className="flex-1">
              {renderItem(item)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`empty-${i}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}
