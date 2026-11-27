// Legacy seed rows use this owner because no Clerk identity can match it.
export const SEED_OWNER = "seed";

// Separate from ordinary seed rows so the moderation fixture can accrue and
// clear strikes without affecting the browsable Calgary seed spots.
export const MODERATION_FIXTURE_OWNER = "seed:moderation-workflow";
export const MODERATION_FIXTURE_REPORTER = "seed:moderation-reporter";

// Increment this only when contributors must accept a materially changed policy.
export const COMMUNITY_STANDARDS_VERSION = 1;

export const MAX_REPORT_PHOTOS = 3;

// A fix is a few photos of the finished work, not a second gallery.
export const MAX_FIX_PHOTOS = 3;
export const MAX_FIX_DETAILS_LENGTH = 500;

// A Request changes message must say enough that the owner knows what to change.
export const MIN_CHANGES_MESSAGE_LENGTH = 10;
export const MAX_CHANGES_MESSAGE_LENGTH = 500;
// The owner's one reply to it, sent with the resubmission.
export const MAX_OWNER_NOTE_LENGTH = 280;
