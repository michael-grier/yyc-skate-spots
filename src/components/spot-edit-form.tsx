import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationPicker } from "@/components/location-picker";
import {
  BustFactorField,
  Field,
  NameInput,
  PhotoStrip,
  SurfaceField,
  TypeCarousel,
} from "@/components/spot-fields";
import { StandardsLine, StandardsSheet } from "@/components/standards-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAX_NOTES_LENGTH, MAX_PHOTOS, type SpotFormValues } from "@/lib/spot-form";
import { type SpotFormSave, useSpotForm } from "@/lib/use-spot-form";
import { colors } from "@/theme/colors";

type SpotEditFormProps = {
  initialValues: SpotFormValues;
  onCancel: () => void;
  onSave: SpotFormSave;
};

/**
 * Notes lifted out of the form and sized to the space above the keyboard, so
 * what you type is never behind it. Editing is live — closing just puts the
 * sheet away.
 */
function NotesFocusEditor({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  return (
    <Modal
      // Driven by the prop rather than unmounted, or there is nothing left for
      // the fade-out to animate. No statusBarTranslucent: it sets
      // FLAG_LAYOUT_NO_LIMITS on Android, which disables the window resize that
      // KeyboardAvoidingView relies on there, leaving the keyboard over the text.
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => inputRef.current?.focus()}
    >
      <View
        accessibilityViewIsModal
        className="flex-1 bg-black/70"
        style={{ paddingTop: insets.top }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close notes"
            onPress={onClose}
            className="h-12"
          />
          <View className="mx-4 mb-3 flex-1 rounded-3xl border border-white/20 bg-card p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-semibold text-[15px] text-ink">Notes</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose}>
                <Text className="font-sans-semibold text-[14px] text-silver">Done</Text>
              </Pressable>
            </View>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChange}
              placeholder="Run-up, ground, when security does laps…"
              placeholderTextColor={colors.mute}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Notes"
              className="mt-3 flex-1 font-sans text-[15px] leading-relaxed text-ink"
              style={{ paddingVertical: 0 }}
            />
            <Text className="mt-2 text-right font-sans text-[12px] text-mute">
              {value.length} / {MAX_NOTES_LENGTH}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Editing an existing spot: everything describing the spot lives in one card so
 * a single change is a scroll-free tap, rather than a walk down six sections of
 * pills.
 */
export function SpotEditForm({ initialValues, onCancel, onSave }: SpotEditFormProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const standardsRef = useRef<BottomSheetModal>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const { values, errors, saving, location, setField, setValues, addPhotos, removePhoto, save } =
    useSpotForm(initialValues, onSave);

  return (
    <View className="flex-1 bg-base">
      <View
        className="flex-row items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel} disabled={saving}>
          <Text className="font-sans text-[15px] text-mute">Cancel</Text>
        </Pressable>
        <Text className="font-sans-semibold text-[17px] text-ink">Edit spot</Text>
        {/* Balances the row so the title stays centred. */}
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        >
          <Card className="mt-4">
            <Field label="NAME" error={errors.name} className="px-4 py-3.5">
              <NameInput value={values.name} onChange={(name) => setField("name", name)} />
            </Field>
            <Field
              label="TYPE"
              hint={`${values.types.length} selected`}
              error={errors.types}
              className="border-t border-white/10 py-3.5 pl-4"
            >
              <TypeCarousel value={values.types} onChange={(types) => setField("types", types)} />
            </Field>
            <Field
              label="BUST FACTOR"
              error={errors.bustFactor}
              className="border-t border-white/10 px-4 py-3.5"
            >
              <BustFactorField
                value={values.bustFactor}
                onChange={(bustFactor) => setField("bustFactor", bustFactor)}
              />
            </Field>
            <Field label="SURFACE" hint="optional" className="border-t border-white/10 px-4 py-3.5">
              <SurfaceField
                value={values.surface}
                onChange={(surface) => setField("surface", surface)}
              />
            </Field>
          </Card>

          <Field
            label="PHOTOS"
            hint={`${values.photos.length} of ${MAX_PHOTOS}`}
            error={errors.photos}
          >
            <PhotoStrip
              photos={values.photos}
              onAdd={() => void addPhotos()}
              onRemove={removePhoto}
            />
          </Field>

          <Field label="LOCATION" error={errors.location}>
            <LocationPicker
              variant="compact"
              value={location}
              onChange={({ latitude, longitude }) =>
                setValues((current) => ({ ...current, latitude, longitude }))
              }
            />
          </Field>

          <Field label="NOTES" error={errors.notes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit notes"
              onPress={() => setNotesOpen(true)}
              className="active:opacity-80"
            >
              <Card className="min-h-[88px] px-4 py-3">
                <Text
                  numberOfLines={4}
                  className={
                    values.notes
                      ? "font-sans text-[15px] leading-relaxed text-ink"
                      : "font-sans text-[15px] leading-relaxed text-mute"
                  }
                >
                  {values.notes || "Run-up, ground, when security does laps…"}
                </Text>
              </Card>
            </Pressable>
          </Field>
        </ScrollView>

        <View
          className="border-t border-white/10 px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="mb-2.5">
            <StandardsLine onPress={() => standardsRef.current?.present()} />
          </View>
          <Button
            label={saving ? "Saving…" : "Save changes"}
            variant="light"
            disabled={saving}
            onPress={() => void save()}
          />
        </View>
      </KeyboardAvoidingView>

      <NotesFocusEditor
        visible={notesOpen}
        value={values.notes}
        onChange={(notes) => setField("notes", notes)}
        onClose={() => setNotesOpen(false)}
      />

      <StandardsSheet
        ref={standardsRef}
        onReadFullStandards={() => {
          standardsRef.current?.dismiss();
          router.push("/standards");
        }}
      />
    </View>
  );
}
