import spotStandards from "./spot-standards.json";

export const REPORT_REASONS = [
  {
    value: "not_a_spot",
    label: "Not a skate spot",
    description: "There is no fixed, skateable feature at this location.",
  },
  {
    value: "duplicate_or_inaccurate",
    label: "Duplicate or inaccurate",
    description: "The spot already exists, or important details and location are wrong.",
  },
  {
    value: "private_or_sensitive",
    label: "Private or sensitive location",
    description: "It exposes a private home or another location that should not be mapped.",
  },
  {
    value: "gone_or_unusable",
    label: "Dead spot",
    description: "The feature was removed, blocked permanently, or can no longer be skated.",
  },
  {
    value: "inappropriate_content",
    label: "Inappropriate content",
    description: "The name, notes, or photos are unrelated, explicit, or harassing.",
  },
  {
    value: "spam_or_abuse",
    label: "Spam or abuse",
    description: "The listing is promotional, intentionally misleading, or abusive.",
  },
  {
    value: "other",
    label: "Something else",
    description: "It does not meet the standards for another reason.",
  },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

// The static public page reads the same JSON at build time, so its rules
// cannot drift from the policy shown before a contribution is submitted.
export const SPOT_STANDARDS = spotStandards;

export function reportReasonLabel(reason: ReportReason) {
  return REPORT_REASONS.find((option) => option.value === reason)?.label ?? "Other";
}
