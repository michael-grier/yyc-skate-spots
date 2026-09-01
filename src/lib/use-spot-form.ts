import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Alert } from "react-native";

import { resolveConvexSiteUrl } from "@/lib/convex-site";
import {
  type FormPhoto,
  MAX_PHOTOS,
  type SpotFormErrors,
  type SpotFormValues,
  type SpotPayload,
  validateSpotForm,
} from "@/lib/spot-form";
import { pickPhotos, uploadPhoto } from "@/lib/spot-photos";

// The env gate in the root layout guarantees these are valid before any form renders.
const UPLOAD_HOST = resolveConvexSiteUrl(
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
);

/** Receives the validated payload and the final photo ids; new photos upload first. */
export type SpotFormSave = (payload: SpotPayload, photoIds: Id<"_storage">[]) => Promise<void>;

/**
 * Field state, photo handling, and the save path shared by the add wizard and
 * the edit form. The two screens differ in layout only.
 */
export function useSpotForm(initialValues: SpotFormValues, onSave: SpotFormSave) {
  const { getToken } = useAuth();
  const discardUpload = useMutation(api.spots.discardUpload);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<SpotFormErrors>({});
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof SpotFormValues>(key: K, value: SpotFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function addPhotos() {
    const picked = await pickPhotos(MAX_PHOTOS - values.photos.length);
    if (picked.length === 0) {
      return;
    }
    setValues((current) => {
      // The picker can hand back a photo that is already attached. Appending it
      // again would show two identical tiles and upload the same bytes twice.
      // Only photos picked in this session can be matched: once one is saved its
      // key is the Convex storage id, and the asset id it came from is gone.
      const attached = new Set(current.photos.map((photo) => photo.key));
      const added = picked.filter((photo) => !attached.has(photo.key));
      return { ...current, photos: [...current.photos, ...added].slice(0, MAX_PHOTOS) };
    });
  }

  function removePhoto(photo: FormPhoto) {
    setValues((current) => ({
      ...current,
      photos: current.photos.filter((p) => p.key !== photo.key),
    }));
  }

  /** Returns the errors that blocked the save, or null once validation passed. */
  async function save(): Promise<SpotFormErrors | null> {
    const result = validateSpotForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return result.errors;
    }
    setErrors({});
    setSaving(true);
    // Uploads happen at save time so a cancelled form leaves no orphan files;
    // if the save itself fails, the fresh uploads are discarded for the same reason.
    const uploaded: Id<"_storage">[] = [];
    try {
      const photoIds: Id<"_storage">[] = [];
      for (const photo of values.photos) {
        if (photo.storageId) {
          photoIds.push(photo.storageId);
          continue;
        }
        const token = await getToken({ template: "convex" });
        if (!token) {
          throw new Error("Sign in again to upload photos.");
        }
        const storageId = await uploadPhoto(photo, UPLOAD_HOST, token);
        uploaded.push(storageId);
        photoIds.push(storageId);
      }
      await onSave(result.payload, photoIds);
    } catch (err) {
      await Promise.allSettled(uploaded.map((storageId) => discardUpload({ storageId })));
      Alert.alert("Couldn't save the spot", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
    return null;
  }

  // Both forms hand this to the picker; deriving it here keeps the null-pair
  // check in one place rather than repeated at each call site.
  const location =
    values.latitude !== null && values.longitude !== null
      ? { latitude: values.latitude, longitude: values.longitude }
      : null;

  return {
    values,
    errors,
    saving,
    location,
    setField,
    setValues,
    setErrors,
    addPhotos,
    removePhoto,
    save,
  };
}
