// Legacy seed rows use this owner because no Clerk identity can match it.
export const SEED_OWNER = "seed";

// Separate from ordinary seed rows so the moderation fixture can accrue and
// clear strikes without affecting the browsable Calgary seed spots.
export const MODERATION_FIXTURE_OWNER = "seed:moderation-workflow";
