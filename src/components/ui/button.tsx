import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { cn } from "@/lib/cn";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Rendered left of the label, e.g. a small icon. */
  icon?: ReactNode;
  /** "light" is the one bright button in the app (Sign in with Apple). */
  variant?: "matte" | "light";
  className?: string;
};

/** Primary matte action button ("Take Me There", form submits). */
export function Button({
  label,
  onPress,
  disabled,
  icon,
  variant = "matte",
  className,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-2xl border py-4 active:opacity-80",
        variant === "light" ? "border-white/30 bg-pinSelected" : "border-white/15 bg-ctagrey",
        disabled && "opacity-40",
        className,
      )}
    >
      {icon}
      <Text
        className={cn(
          "font-sans-semibold text-[16px]",
          variant === "light" ? "text-pinSelectedInk" : "text-ink",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
