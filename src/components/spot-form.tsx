import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CloseIcon } from "@/components/icons";
import { LocationPicker } from "@/components/location-picker";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  type FormPhoto,
  MAX_PHOTOS,
  type SpotFormErrors,
  type SpotFormValues,
  type SpotPayload,
  validateSpotForm,
} from "@/lib/spot-form";
import {
  BUST_FACTOR_COLORS,
  BUST_FACTOR_LABELS,
  BUST_FACTORS,
  SPOT_TYPE_LABELS,
  SPOT_TYPES,
  SURFACE_LABELS,
  SURFACES,
} from "@/lib/spot-labels";
import { resolveConvexSiteUrl } from "@/lib/convex-site";
import { pickPhotos, uploadPhoto } from "@/lib/spot-photos";
import { colors } from "@/theme/colors";

// The env gate in the root layout guarantees these are valid before any form renders.
const UPLOAD_HOST = resolveConvexSiteUrl(
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
);

type SpotFormProps = {
  title: string;
  initialValues: SpotFormValues;
  onCancel: () => void;
  /** Receives the validated payload and the final photo ids; new photos are uploaded first. */
  onSave: (payload: SpotPayload, photoIds: Id<"_storage">[]) => Promise<void>;
};

function Section({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-2 px-1 font-sans-medium text-[11px] text-mute">{label}</Text>
      {children}
      {error ? (
        <Text className="mt-1.5 px-1 font-sans text-[12px] text-bust-high">{error}</Text>
      ) : null}
    </View>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Add/edit spot form from the approved mock, plus an optional surface row. */
export function SpotForm({ title, initialValues, onCancel, onSave }: SpotFormProps) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const discardUpload = useMutation(api.spots.discardUpload);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<SpotFormErrors>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SpotFormValues>(key: K, value: SpotFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function addPhotos() {
    const picked = await pickPhotos(MAX_PHOTOS - values.photos.length);
    if (picked.length > 0) {
      setValues((current) => ({
        ...current,
        photos: [...current.photos, ...picked].slice(0, MAX_PHOTOS),
      }));
    }
  }

  function removePhoto(photo: FormPhoto) {
    setValues((current) => ({
      ...current,
      photos: current.photos.filter((p) => p.key !== photo.key),
    }));
  }

  async function save() {
    const result = validateSpotForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
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
  }

  const location =
    values.latitude !== null && values.longitude !== null
      ? { latitude: values.latitude, longitude: values.longitude }
      : null;

  return (
    <View className="flex-1 bg-base">
      <View
        className="flex-row items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel} disabled={saving}>
          <Text className="font-sans text-[15px] text-mute">Cancel</Text>
        </Pressable>
        <Text className="font-sans-semibold text-[17px] text-ink">{title}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void save()}
          disabled={saving}
        >
          <Text className="font-sans-semibold text-[15px] text-silver">
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      {/* Keeps the focused field (notably the notes box at the bottom) above the keyboard. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        >
          <Card className="mt-4 p-4">
            <Text className="font-sans-semibold text-[14px] text-ink">Keep the map useful</Text>
            <Text className="mt-1 font-sans text-[12px] leading-relaxed text-mute">
              Only submit real, accurate, shareable skate spots. Saving confirms that this listing
              meets the spot standards.
            </Text>
            <Link href="/standards" asChild>
              <Pressable
                accessibilityRole="link"
                className="mt-2 self-start py-1 active:opacity-80"
              >
                <Text className="font-sans-semibold text-[12px] text-silver">
                  Read the spot standards
                </Text>
              </Pressable>
            </Link>
          </Card>

          <Section label="NAME" error={errors.name}>
            <Card className="px-4 py-3">
              <TextInput
                value={values.name}
                onChangeText={(name) => set("name", name)}
                placeholder="What do locals call it?"
                placeholderTextColor={colors.mute}
                accessibilityLabel="Spot name"
                className="font-sans text-[15px] text-ink"
                style={{ paddingVertical: 0 }}
              />
            </Card>
          </Section>

          <Section label="TYPE" error={errors.types}>
            <View className="flex-row flex-wrap gap-2">
              {SPOT_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={SPOT_TYPE_LABELS[type]}
                  selected={values.types.includes(type)}
                  onPress={() => set("types", toggle(values.types, type))}
                />
              ))}
            </View>
          </Section>

          <Section label="BUST FACTOR" error={errors.bustFactor}>
            <View className="flex-row gap-2">
              {BUST_FACTORS.map((bust) => (
                <Chip
                  key={bust}
                  label={BUST_FACTOR_LABELS[bust]}
                  dotColor={BUST_FACTOR_COLORS[bust]}
                  selected={values.bustFactor === bust}
                  onPress={() => set("bustFactor", bust)}
                  className="flex-1"
                />
              ))}
            </View>
          </Section>

          <Section label="SURFACE (OPTIONAL)">
            <View className="flex-row gap-2">
              {SURFACES.map((surface) => (
                <Chip
                  key={surface}
                  label={SURFACE_LABELS[surface]}
                  selected={values.surface === surface}
                  // Tapping the selected one clears it, since the field is optional.
                  onPress={() => set("surface", values.surface === surface ? null : surface)}
                  className="flex-1"
                />
              ))}
            </View>
          </Section>

          <Section label="PHOTOS" error={errors.photos}>
            <View className="flex-row flex-wrap gap-2.5">
              {values.photos.map((photo, index) => (
                <View key={photo.key} className="h-20 w-20">
                  <Image
                    source={{ uri: photo.uri }}
                    contentFit="cover"
                    accessible
                    accessibilityLabel={`Selected photo ${index + 1}`}
                    style={{ width: 80, height: 80, borderRadius: 12 }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                    hitSlop={6}
                    onPress={() => removePhoto(photo)}
                    className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full border border-white/20"
                    style={{ backgroundColor: "rgba(30,32,36,0.95)" }}
                  >
                    <CloseIcon size={12} color={colors.ink} />
                  </Pressable>
                </View>
              ))}
              {values.photos.length < MAX_PHOTOS ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add photos"
                  onPress={() => void addPhotos()}
                  className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-white/20 active:opacity-80"
                >
                  <Text className="font-sans text-[24px] text-mute">+</Text>
                </Pressable>
              ) : null}
            </View>
          </Section>

          <Section label="LOCATION" error={errors.location}>
            <LocationPicker
              value={location}
              onChange={({ latitude, longitude }) =>
                setValues((current) => ({ ...current, latitude, longitude }))
              }
            />
            <Text className="mt-1.5 px-1 font-sans text-[12px] text-mute">
              Drag the map until the pin sits on the spot.
            </Text>
          </Section>

          <Section label="NOTES" error={errors.notes}>
            <Card className="px-4 py-3">
              <TextInput
                value={values.notes}
                onChangeText={(notes) => set("notes", notes)}
                placeholder="Run-up, ground, when security does laps…"
                placeholderTextColor={colors.mute}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Notes"
                className="min-h-[96px] font-sans text-[15px] leading-relaxed text-ink"
                style={{ paddingVertical: 0 }}
              />
            </Card>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
