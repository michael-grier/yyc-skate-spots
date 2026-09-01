import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";

type SegmentedOption<T> = {
  value: T;
  /** Doubles as the React key, so labels must be unique within one control. */
  label: string;
  /** Small leading dot, used for the bust-factor semantic colors. */
  dotColor?: string;
};

type SegmentedProps<T> = {
  options: readonly SegmentedOption<T>[];
  /** null selects nothing, for a required field the skater has not answered yet. */
  value: T | null;
  onChange: (value: T) => void;
};

/**
 * One track of equal-width choices. Unlike a row of chips it holds its height
 * and alignment however many options it carries, which is what keeps the form's
 * single-choice fields from reading as another wall of pills.
 */
export function Segmented<T>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View className="flex-row gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={cn(
              "min-h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] px-1 active:opacity-80",
              selected && "bg-ctagrey",
            )}
          >
            {option.dotColor ? (
              <View
                className="h-1.5 w-1.5 rounded-full"
                // Unselected dots dim so color alone never reads as the active choice.
                style={{ backgroundColor: option.dotColor, opacity: selected ? 1 : 0.4 }}
              />
            ) : null}
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
              className={cn(
                "text-[13px]",
                selected ? "font-sans-semibold text-ink" : "font-sans-medium text-mute",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
