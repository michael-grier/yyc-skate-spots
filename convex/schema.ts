import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const spotType = v.union(
  v.literal("rail"),
  v.literal("ledge"),
  v.literal("stairs"),
  v.literal("manny_pad"),
  v.literal("gap"),
  v.literal("other"),
);

export const bustFactor = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

export const surface = v.union(v.literal("smooth"), v.literal("rough"));

export default defineSchema({
  spots: defineTable({
    name: v.string(),
    type: spotType,
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
});
