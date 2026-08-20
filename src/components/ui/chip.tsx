import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Small leading dot, used for the bust-factor semantic colors. */
  dotColor?: string;
  /** Rendered after the label, e.g. a disclosure chevron. */
  trailing?: ReactNode;
  className?: string;
};

/** Pill control used by map filters and the bust-factor selector. */
export function Chip({ label, selected, onPress, dotColor, trailing, className }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={cn(
        "flex-row items-center justify-center gap-1.5 rounded-full border px-3.5 py-2 active:opacity-80",
        selected ? "border-white/20 bg-white/10" : "border-white/10",
        className,
      )}
    >
      {dotColor ? (
        <View
          className="h-1.5 w-1.5 rounded-full"
          // Unselected dots dim so color alone doesn't imply an active filter.
          style={{ backgroundColor: dotColor, opacity: selected ? 1 : 0.4 }}
        />
      ) : null}
      <Text
        className={cn(
          "text-[13px]",
          selected ? "font-sans-semibold text-ink" : "font-sans-medium text-mute",
        )}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}
