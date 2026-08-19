import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

/** 1px divider, e.g. between rows of the spot-detail facts grid. */
export function Hairline({ className, ...props }: ViewProps) {
  return <View className={cn("h-px bg-white/10", className)} {...props} />;
}
