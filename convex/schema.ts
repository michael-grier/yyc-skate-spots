import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Handrails and flatbars are deliberately separate: they skate completely
// differently even though both are "rails".
export const spotType = v.union(
  v.literal("ledge"),
  v.literal("handrail"),
  v.literal("flatbar"),
  v.literal("stairs"),
  v.literal("manny_pad"),
  v.literal("gap"),
  v.literal("curb"),
  v.literal("bank"),
  v.literal("bump"),
  v.literal("hubba"),
  v.literal("drop"),
  v.literal("skate_park"),
  v.literal("diy"),
  v.literal("wallride"),
  v.literal("flatground"),
  v.literal("transition"),
  v.literal("other"),
);

export const bustFactor = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

export const surface = v.union(v.literal("smooth"), v.literal("rough"));

export const reportReason = v.union(
  v.literal("not_a_spot"),
  v.literal("duplicate_or_inaccurate"),
  v.literal("private_or_sensitive"),
  v.literal("gone_or_unusable"),
  v.literal("inappropriate_content"),
  v.literal("spam_or_abuse"),
  v.literal("other"),
);

// Bundle IDs of the app variants in src/lib/app-variants.ts. Apple issues each
// authorization code to one of them and accepts it only from that client.
export const appleClientId = v.union(
  v.literal("com.yycskatespots.app"),
  v.literal("com.yycskatespots.app.preview"),
  v.literal("com.yycskatespots.app.dev"),
);

export const noticeKind = v.union(
  v.literal("spot_published"),
  v.literal("spot_removed"),
  v.literal("report_kept"),
  v.literal("report_removed"),
  v.literal("spot_changes_requested"),
);

// Why a spot was last put in front of an admin, apart from any reports on it.
export const submissionReason = v.union(
  v.literal("new"),
  v.literal("edited"),
  v.literal("resubmitted"),
);

const reviewReason = v.union(
  v.literal("new"),
  v.literal("edited"),
  v.literal("resubmitted"),
  v.literal("reported"),
);

export default defineSchema({
  // Saved display names. Accounts without a row show a derived anonymous name.
  profiles: defineTable({
    userIdentifier: v.string(),
    displayName: v.string(),
  }).index("by_userIdentifier", ["userIdentifier"]),

  spots: defineTable({
    name: v.string(),
    // Most real spots have more than one obstacle (a plaza with ledges and
    // a stair set), so a spot carries every type that applies.
    types: v.array(spotType),
    bustFactor,
    surface: v.optional(surface),
    notes: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    // Bounded by MAX_PHOTOS in convex/spots.ts, so an array is safe here.
    photoIds: v.array(v.id("_storage")),
    // Permission is owner-controlled; absent on older spots means no consent.
    allowAdminPhotos: v.optional(v.boolean()),
    adminPhotosAddedAt: v.optional(v.number()),
    adminPhotosUnseen: v.optional(v.boolean()),
    // Owner consent for locals to fix the spot up. Never set on a private spot,
    // since nobody else can see it. Absent on older spots means not tagged.
    needsWork: v.optional(v.boolean()),
    // Set when an admin approves a fix. The tag can't be set again afterwards, so
    // each spot is fixed up at most once.
    workCompletedAt: v.optional(v.number()),
    // Clerk identity tokenIdentifier — the ownership key for edit/delete.
    createdBy: v.string(),
    // Legacy/provider fallback. Queries prefer the current name in profiles.
    createdByName: v.optional(v.string()),
    // Optional during rollout so existing rows remain valid. Public reads use
    // their moderation row as the fallback until the next review or edit.
    // "private" is owner-chosen: visible only to the creator, never reviewed.
    // "needs_changes" is an admin's send-back: hidden like "pending" until the owner resubmits.
    publicationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("published"),
        v.literal("private"),
        v.literal("needs_changes"),
      ),
    ),
    // Hides a deleted spot while its unbounded favorite rows are removed in
    // scheduled batches. The final batch physically deletes this document.
    deletionRequested: v.optional(v.boolean()),
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_createdBy_and_deletionRequested", ["createdBy", "deletionRequested"]),

  // One row per saved spot. The Clerk tokenIdentifier stays server-derived,
  // while the indexes cover profile ordering, membership, and spot deletion.
  favorites: defineTable({
    userId: v.string(),
    spotId: v.id("spots"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_spotId", ["userId", "spotId"])
    .index("by_spotId_and_userId", ["spotId", "userId"]),

  // One row per photo attached to a spot. The index makes "is this file
  // already someone's photo?" a single lookup instead of a table scan, so
  // the ownership check stays correct at any table size.
  spotPhotos: defineTable({
    storageId: v.id("_storage"),
    spotId: v.id("spots"),
  }).index("by_storageId", ["storageId"]),

  // Photos of a fix someone made to a tagged spot. A spot has at most one row: pending
  // until an admin decides, then kept (with acceptedAt) as the credit for the approved
  // photos. Rejected fixes are deleted. Bounded by MAX_FIX_PHOTOS in convex/constants.ts.
  spotWork: defineTable({
    spotId: v.id("spots"),
    submittedBy: v.string(),
    photoIds: v.array(v.id("_storage")),
    details: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_spotId", ["spotId"])
    .index("by_submittedBy", ["submittedBy"]),

  // Who uploaded each not-yet-attached file. A row is created right after
  // the upload and consumed when the photo is attached to a spot, so only
  // the uploader can attach or discard it.
  uploads: defineTable({
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_uploadedBy", ["uploadedBy"]),

  // Pending evidence is separate from public spot uploads and expires after 24 hours.
  reportUploads: defineTable({
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_uploadedBy", ["uploadedBy"]),

  // Reports stay private and exist only while a spot awaits a decision.
  // Removing them on resolution lets the same person report a later edit.
  spotReports: defineTable({
    spotId: v.id("spots"),
    reportedBy: v.string(),
    // Optional for reports submitted before evidence was supported.
    photoIds: v.optional(v.array(v.id("_storage"))),
    reason: reportReason,
    details: v.optional(v.string()),
    // The live name the reporter saw. An owner's edit can rename the spot before the
    // decision, and the reporter's update must not show a name that was never approved.
    // Absent on reports filed before the snapshot existed.
    spotName: v.optional(v.string()),
  })
    .index("by_spotId", ["spotId"])
    .index("by_spotId_and_reportedBy", ["spotId", "reportedBy"])
    .index("by_reportedBy", ["reportedBy"]),

  // Operational review state is separate from the public spot document so
  // owner edits cannot overwrite moderation fields through spots.update.
  spotModeration: defineTable({
    spotId: v.id("spots"),
    spotCreationTime: v.number(),
    needsReview: v.boolean(),
    attentionReason: reviewReason,
    lastSubmittedAt: v.number(),
    openReportCount: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
    // Absent on rows from before it was tracked; see legacySubmissionReason.
    submissionReason: v.optional(submissionReason),
    // Rises on every review-state change. Decisions carry the version the admin saw, so a
    // decision made on a stale screen is refused. Absent counts as 0.
    reviewVersion: v.optional(v.number()),
    // The admin's last Request changes message, kept through the resubmission so the next
    // review shows it beside the owner's note.
    requestedChanges: v.optional(v.object({ message: v.string(), at: v.number() })),
    ownerNote: v.optional(v.string()),
  })
    .index("by_spotId", ["spotId"])
    .index("by_reviewedBy", ["reviewedBy"]),

  // Admin removal deletes the public spot but keeps this small owner-visible
  // record. Photos, coordinates, notes, and report identities are not retained.
  spotRemovals: defineTable({
    spotId: v.id("spots"),
    spotCreationTime: v.number(),
    name: v.string(),
    createdBy: v.string(),
    createdByName: v.optional(v.string()),
    reason: reportReason,
    // Internal moderation notes. Never returned to the owner.
    details: v.optional(v.string()),
    // Shown to the owner word for word on their removal notice.
    ownerMessage: v.optional(v.string()),
    removedAt: v.number(),
    // Cleared if the reviewing administrator later deletes their account.
    removedBy: v.optional(v.string()),
    reportCount: v.number(),
    strikeNumber: v.number(),
  })
    .index("by_spotId", ["spotId"])
    .index("by_createdBy_and_spotCreationTime", ["createdBy", "spotCreationTime"])
    .index("by_removedBy", ["removedBy"]),

  // A contribution ban leaves sign-in intact so the user can still browse,
  // delete their remaining spots, and read removal notices.
  userModeration: defineTable({
    userIdentifier: v.string(),
    name: v.optional(v.string()),
    confirmedRemovalCount: v.number(),
    isBanned: v.boolean(),
    bannedAt: v.optional(v.number()),
    bannedBy: v.optional(v.string()),
  })
    .index("by_userIdentifier", ["userIdentifier"])
    .index("by_isBanned_and_confirmedRemovalCount", ["isBanned", "confirmedRemovalCount"])
    .index("by_bannedBy", ["bannedBy"]),

  // One row per contributor records the policy version accepted before their
  // first public-content action. The server checks it independently of the UI.
  communityAcknowledgements: defineTable({
    userIdentifier: v.string(),
    standardsVersion: v.number(),
    acceptedAt: v.number(),
  }).index("by_userIdentifier", ["userIdentifier"]),

  // Private, short-lived recovery state keeps Apple revocation and Clerk
  // deletion safe to retry without exposing tokens through a public query.
  accountDeletionRequests: defineTable({
    userIdentifier: v.string(),
    clerkUserId: v.string(),
    requestedAt: v.number(),
    appleToken: v.optional(v.string()),
    appleTokenType: v.optional(v.union(v.literal("access_token"), v.literal("refresh_token"))),
    // Absent for tokens stored before variants existed, which all came from the store app.
    appleClientId: v.optional(appleClientId),
    appleRevoked: v.boolean(),
  }).index("by_userIdentifier", ["userIdentifier"]),

  // One-way updates from YYC Skate Spots, private to their recipient. There is
  // no sender field, so an administrator's account deletion leaves them intact.
  notices: defineTable({
    recipient: v.string(),
    kind: noticeKind,
    // Absent when the spot is gone for the recipient, such as a reporter's removed spot.
    spotId: v.optional(v.id("spots")),
    // A snapshot, so the update still reads correctly after the spot changes or goes.
    spotName: v.string(),
    // The removal reason for an owner; the reporter's own reason on report outcomes.
    reason: v.optional(reportReason),
    message: v.optional(v.string()),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient", ["recipient"])
    .index("by_recipient_and_readAt", ["recipient", "readAt"]),
});
