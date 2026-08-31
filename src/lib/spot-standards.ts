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
    label: "Gone or unusable",
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

export const SPOT_STANDARDS = [
  {
    title: "It is a real skate spot",
    description:
      "Add a fixed, skateable street feature in Calgary or the nearby area, such as a ledge, rail, stair set, bank, gap, or curb—not a meetup point, event, or temporary object.",
  },
  {
    title: "The listing is accurate",
    description:
      "Place the pin on the feature, use a recognizable name, choose the right attributes, and do not add a spot that is already on the map.",
  },
  {
    title: "The location is appropriate to share",
    description:
      "Do not map private homes, schools or sensitive facilities where publishing the exact location could create a safety or privacy problem.",
  },
  {
    title: "The spot still exists",
    description:
      "Do not add features that have been removed, are permanently blocked, or are otherwise no longer skateable.",
  },
  {
    title: "The content helps skaters",
    description:
      "Keep names, notes, and photos relevant. Harassment, explicit material, spam, promotion, and deliberately misleading content are not allowed.",
  },
  {
    title: "You can share the photos",
    description:
      "Upload photos you took or have permission to share, and avoid identifiable people when they are not relevant to the spot.",
  },
] as const;

export function reportReasonLabel(reason: ReportReason) {
  return REPORT_REASONS.find((option) => option.value === reason)?.label ?? "Other";
}
