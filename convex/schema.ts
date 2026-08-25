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
  v.literal("other"),
);

export const bustFactor = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

export const surface = v.union(v.literal("smooth"), v.literal("rough"));

export default defineSchema({
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
    // Clerk identity tokenIdentifier — the ownership key for edit/delete.
    createdBy: v.string(),
    // Denormalized at creation for the "Added by …" byline, so reads never
    // need a Clerk lookup. Not updated if the user later renames themselves.
    createdByName: v.optional(v.string()),
  }).index("by_createdBy", ["createdBy"]),

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

  // Who uploaded each not-yet-attached file. A row is created right after
  // the upload and consumed when the photo is attached to a spot, so only
  // the uploader can attach or discard it.
  uploads: defineTable({
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
  }).index("by_storageId", ["storageId"]),
});
