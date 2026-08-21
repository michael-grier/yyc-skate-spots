import type { Id } from "@convex/_generated/dataModel";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { FormPhoto } from "@/lib/spot-form";

// Phone photos are 12MP+; a 1600px long edge is plenty for a detail screen
// and keeps uploads to a few hundred KB.
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;

/** Opens the photo library; resolves to [] if the user cancels or declines permission. */
export async function pickPhotos(limit: number): Promise<FormPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) {
    return [];
  }
  return result.assets.map((asset) => ({
    key: asset.assetId ?? asset.uri,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}

/** Downscales and re-encodes a picked photo, then POSTs it to a Convex upload URL. */
export async function uploadPhoto(photo: FormPhoto, uploadUrl: string): Promise<Id<"_storage">> {
  const context = ImageManipulator.manipulate(photo.uri);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(photo.width, photo.height));
  if (scale < 1) {
    context.resize({
      width: Math.round(photo.width * scale),
      height: Math.round(photo.height * scale),
    });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  const body = await (await fetch(saved.uri)).blob();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body,
  });
  if (!response.ok) {
    throw new Error("Photo upload failed.");
  }
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
