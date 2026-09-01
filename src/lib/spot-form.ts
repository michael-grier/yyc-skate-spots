import type { Id } from "@convex/_generated/dataModel";
import { z } from "zod";

import {
  BUST_FACTORS,
  SPOT_TYPES,
  SURFACES,
  type BustFactor,
  type SpotType,
  type Surface,
} from "@/lib/spot-labels";

// Client-side copies of the caps in convex/spots.ts; the server re-checks.
export const MAX_PHOTOS = 6;
export const MAX_NAME_LENGTH = 80;
export const MAX_NOTES_LENGTH = 2000;

/** A photo in the form: already stored (edit) or picked locally (upload on save). */
export type FormPhoto = {
  /** Stable identity for list keys and removal. */
  key: string;
  uri: string;
  width: number;
  height: number;
  storageId?: Id<"_storage">;
};

export type SpotFormValues = {
  name: string;
  types: SpotType[];
  bustFactor: BustFactor | null;
  surface: Surface | null;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  photos: FormPhoto[];
};

export const EMPTY_SPOT_FORM: SpotFormValues = {
  name: "",
  types: [],
  bustFactor: null,
  surface: null,
  notes: "",
  latitude: null,
  longitude: null,
  photos: [],
};

type EditableSpot = {
  name: string;
  types: SpotType[];
  bustFactor: BustFactor;
  surface?: Surface;
  notes?: string;
  latitude: number;
  longitude: number;
  photoIds: Id<"_storage">[];
  photoUrls: string[];
};

/** Prefills the form from a spot the owner is editing. */
export function spotToFormValues(spot: EditableSpot): SpotFormValues {
  return {
    name: spot.name,
    types: spot.types,
    bustFactor: spot.bustFactor,
    surface: spot.surface ?? null,
    notes: spot.notes ?? "",
    latitude: spot.latitude,
    longitude: spot.longitude,
    // photoIds and photoUrls are parallel arrays from api.spots.get. Stored
    // photos have no dimensions to hand and are never re-encoded, so 0 is fine.
    photos: spot.photoIds.map((storageId, i) => ({
      key: storageId,
      uri: spot.photoUrls[i] ?? "",
      width: 0,
      height: 0,
      storageId,
    })),
  };
}

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the spot a name.")
    .max(MAX_NAME_LENGTH, `Keep the name under ${MAX_NAME_LENGTH} characters.`),
  types: z.array(z.enum(SPOT_TYPES as [SpotType, ...SpotType[]])).min(1, "Pick at least one type."),
  bustFactor: z.enum(BUST_FACTORS, { error: "Pick a bust factor." }),
  surface: z.enum(SURFACES).nullable(),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_LENGTH, `Keep notes under ${MAX_NOTES_LENGTH} characters.`),
  latitude: z.number({ error: "Set the spot location." }).min(-90).max(90),
  longitude: z.number({ error: "Set the spot location." }).min(-180).max(180),
});

export type SpotFormErrors = Partial<
  Record<"name" | "types" | "bustFactor" | "notes" | "location" | "photos", string>
>;

/** What create/update accept, minus photoIds (uploaded separately on save). */
export type SpotPayload = {
  name: string;
  types: SpotType[];
  bustFactor: BustFactor;
  surface?: Surface;
  notes?: string;
  latitude: number;
  longitude: number;
};

export function validateSpotForm(
  values: SpotFormValues,
): { ok: true; payload: SpotPayload } | { ok: false; errors: SpotFormErrors } {
  const errors: SpotFormErrors = {};
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      const key = field === "latitude" || field === "longitude" ? "location" : field;
      if (typeof key === "string" && key in EMPTY_SPOT_FORM && !(key in errors)) {
        errors[key as keyof SpotFormErrors] = issue.message;
      } else if (key === "location" && !errors.location) {
        errors.location = issue.message;
      }
    }
  }
  if (values.photos.length > MAX_PHOTOS) {
    errors.photos = `Up to ${MAX_PHOTOS} photos per spot.`;
  }
  if (!parsed.success || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const { surface, notes, ...rest } = parsed.data;
  return {
    ok: true,
    payload: {
      ...rest,
      ...(surface ? { surface } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}
