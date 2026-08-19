import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { cn } from "@/lib/cn";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Rendered left of the label, e.g. a small icon. */
  icon?: ReactNode;
  className?: string;
};

/** Primary matte action button ("Take Me There", form submits). */
export function Button({ label, onPress, disabled, icon, className }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-2xl border border-white/15 bg-ctagrey py-4 active:opacity-80",
        disabled && "opacity-40",
        className,
      )}
    >
      {icon}
      <Text className="font-sans-semibold text-[16px] text-ink">{label}</Text>
    </Pressable>
  );
}
