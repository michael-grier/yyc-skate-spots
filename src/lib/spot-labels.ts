import type { Doc } from "@convex/_generated/dataModel";

import { colors } from "@/theme/colors";

export type SpotType = Doc<"spots">["types"][number];
export type BustFactor = Doc<"spots">["bustFactor"];
export type Surface = NonNullable<Doc<"spots">["surface"]>;

export const SPOT_TYPE_LABELS: Record<SpotType, string> = {
  ledge: "Ledge",
  handrail: "Handrail",
  flatbar: "Flatbar",
  stairs: "Stairs",
  manny_pad: "Manny pad",
  gap: "Gap",
  curb: "Curb",
  bank: "Bank",
  bump: "Bump",
  hubba: "Hubba",
  drop: "Drop",
  other: "Other",
};

/** Every spot type, in the order the add form and filter sheet list them. */
export const SPOT_TYPES = Object.keys(SPOT_TYPE_LABELS) as SpotType[];

export const BUST_FACTORS = ["low", "medium", "high"] as const satisfies readonly BustFactor[];

export const BUST_FACTOR_LABELS: Record<BustFactor, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const BUST_FACTOR_COLORS: Record<BustFactor, string> = colors.bust;

export const SURFACE_LABELS: Record<Surface, string> = {
  smooth: "Smooth",
  rough: "Rough",
};

/** "Ledge · Stairs" for subtitles and preview cards. */
export function formatSpotTypes(types: SpotType[]) {
  return types.map((type) => SPOT_TYPE_LABELS[type]).join(" · ");
}
