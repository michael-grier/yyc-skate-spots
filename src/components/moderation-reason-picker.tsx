import { Pressable, Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { type ReportReason, REPORT_REASONS } from "@/lib/spot-standards";

type ModerationReasonPickerProps = {
  value: ReportReason | null;
  onChange: (reason: ReportReason) => void;
};

/** Shared reason cards keep user reports and admin removals on the same policy vocabulary. */
export function ModerationReasonPicker({ value, onChange }: ModerationReasonPickerProps) {
  return (
    <View className="gap-2">
      {REPORT_REASONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            className="active:opacity-80"
          >
            <Card className={cn("flex-row gap-3 p-4", selected && "border-white/30 bg-ctagrey")}>
              <View
                className={cn(
                  "mt-0.5 h-5 w-5 items-center justify-center rounded-full border border-white/30",
                  selected && "border-silver",
                )}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-silver" /> : null}
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-[14px] text-ink">{option.label}</Text>
                <Text className="mt-0.5 font-sans text-[12px] leading-relaxed text-mute">
                  {option.description}
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
