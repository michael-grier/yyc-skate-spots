import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

/** Solid matte surface with a hairline border. */
export function Card({ className, ...props }: ViewProps) {
  return (
    <View className={cn("rounded-2xl border border-white/10 bg-card", className)} {...props} />
  );
}
