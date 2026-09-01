import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
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
  TypeGrid,
} from "@/components/spot-fields";
import { StandardsLine, StandardsSheet } from "@/components/standards-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  EMPTY_SPOT_FORM,
  firstInvalidStep,
  MAX_NOTES_LENGTH,
  MAX_PHOTOS,
  SPOT_FORM_STEPS,
  type SpotFormStep,
  validateSpotStep,
} from "@/lib/spot-form";
import { useKeyboardVisible } from "@/lib/use-keyboard-visible";
import { type SpotFormSave, useSpotForm } from "@/lib/use-spot-form";
import { colors } from "@/theme/colors";

const STEP_COPY: Record<SpotFormStep, { title: string; action: string }> = {
  basics: { title: "What is it?", action: "Next · Place" },
  place: { title: "Where is it?", action: "Next · Details" },
  details: { title: "What should skaters know?", action: "Save spot" },
};

type SpotCreateFormProps = {
  onCancel: () => void;
  onSave: SpotFormSave;
};

/**
 * Adding a spot, one question at a time. Splitting the form into three short
 * steps keeps every step shorter than a screen, which is what lets notes sit at
 * the top of its own step instead of under the keyboard at the bottom of a
 * six-section scroll.
 */
export function SpotCreateForm({ onCancel, onSave }: SpotCreateFormProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboardVisible = useKeyboardVisible();
  const standardsRef = useRef<BottomSheetModal>(null);
  const [step, setStep] = useState<SpotFormStep>("basics");
  const {
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
  } = useSpotForm(EMPTY_SPOT_FORM, onSave);

  const stepIndex = SPOT_FORM_STEPS.indexOf(step);
  const isLastStep = stepIndex === SPOT_FORM_STEPS.length - 1;
  // Notes is the only input on the details step, so a keyboard there means it is
  // being typed into. Reading the keyboard rather than the field's focus events
  // is what keeps a hardware back press or a step change — neither of which
  // reliably fires onBlur — from stranding the form with no Save button.
  const editingNotes = keyboardVisible && step === "details";

  function goNext() {
    const stepErrors = validateSpotStep(values, step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      return;
    }
    setStep(SPOT_FORM_STEPS[stepIndex + 1]);
  }

  function goBack() {
    if (stepIndex === 0) {
      onCancel();
      return;
    }
    setErrors({});
    setStep(SPOT_FORM_STEPS[stepIndex - 1]);
  }

  async function handleSave() {
    const blocking = await save();
    // A field can still fail here — a name trimmed to nothing, say — so send the
    // skater back to the step that owns it rather than to a dead Save button.
    const target = blocking ? firstInvalidStep(blocking) : null;
    if (target) {
      setStep(target);
    }
  }

  return (
    <View className="flex-1 bg-base">
      <View
        className="flex-row items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityRole="button" hitSlop={8} onPress={goBack} disabled={saving}>
          <Text className="font-sans text-[15px] text-mute">
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Text>
        </Pressable>
        <Text className="font-sans-semibold text-[17px] text-ink">New spot</Text>
        {/* Balances the row so the title stays centred. */}
        <View style={{ width: 52 }} />
      </View>

      <View
        className="flex-row gap-1.5 px-5"
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${stepIndex + 1} of ${SPOT_FORM_STEPS.length}`}
      >
        {SPOT_FORM_STEPS.map((name, index) => (
          <View
            key={name}
            className={cn(
              "h-[3px] flex-1 rounded-full",
              index <= stepIndex ? "bg-silver" : "bg-white/10",
            )}
          />
        ))}
      </View>

      {/* The heading yields to the keyboard so the field being typed into keeps the room. */}
      {keyboardVisible ? null : (
        <View className="px-5 pb-1 pt-4">
          <Text className="font-sans text-[12px] text-mute">
            Step {stepIndex + 1} of {SPOT_FORM_STEPS.length}
          </Text>
          <Text className="mt-0.5 font-sans-semibold text-[22px] tracking-tight text-ink">
            {STEP_COPY[step].title}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        >
          {step === "basics" ? (
            <>
              <Field label="NAME" error={errors.name}>
                <Card className="px-4 py-3">
                  <NameInput value={values.name} onChange={(name) => setField("name", name)} />
                </Card>
              </Field>
              <Field label="TYPE" hint="pick everything that applies" error={errors.types}>
                <TypeGrid value={values.types} onChange={(types) => setField("types", types)} />
              </Field>
            </>
          ) : null}

          {step === "place" ? (
            <>
              <Field label="LOCATION" error={errors.location}>
                <LocationPicker
                  value={location}
                  onChange={({ latitude, longitude }) =>
                    setValues((current) => ({ ...current, latitude, longitude }))
                  }
                />
              </Field>
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
            </>
          ) : null}

          {step === "details" ? (
            <>
              <Field label="NOTES" error={errors.notes}>
                <Card className="px-4 py-3">
                  <TextInput
                    value={values.notes}
                    onChangeText={(notes) => setField("notes", notes)}
                    placeholder="Run-up, ground, when security does laps…"
                    placeholderTextColor={colors.mute}
                    multiline
                    textAlignVertical="top"
                    // The counter below advertises this cap, so hold the input to it
                    // instead of letting a save fail validation after the fact.
                    maxLength={MAX_NOTES_LENGTH}
                    accessibilityLabel="Notes"
                    className="min-h-[150px] font-sans text-[15px] leading-relaxed text-ink"
                    style={{ paddingVertical: 0 }}
                  />
                </Card>
              </Field>
              <Field label="BUST FACTOR" error={errors.bustFactor}>
                <BustFactorField
                  value={values.bustFactor}
                  onChange={(bustFactor) => setField("bustFactor", bustFactor)}
                />
              </Field>
              <Field label="SURFACE" hint="optional">
                <SurfaceField
                  value={values.surface}
                  onChange={(surface) => setField("surface", surface)}
                />
              </Field>
            </>
          ) : null}
        </ScrollView>

        {editingNotes ? (
          <View className="flex-row items-center justify-between border-t border-white/10 bg-card px-5 py-2.5">
            <Text className="font-sans text-[12px] text-mute">
              {values.notes.length} / {MAX_NOTES_LENGTH}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => Keyboard.dismiss()}>
              <Text className="font-sans-semibold text-[14px] text-silver">Done</Text>
            </Pressable>
          </View>
        ) : (
          <View
            // No safe-area padding here: this screen sits in the tab navigator,
            // and the tab bar below already consumes the bottom inset.
            className="border-t border-white/10 px-5 pb-3 pt-3"
          >
            {isLastStep ? (
              <View className="mb-2.5">
                <StandardsLine onPress={() => standardsRef.current?.present()} />
              </View>
            ) : null}
            <Button
              label={saving ? "Saving…" : STEP_COPY[step].action}
              variant="light"
              disabled={saving}
              onPress={isLastStep ? () => void handleSave() : goNext}
            />
          </View>
        )}
      </KeyboardAvoidingView>

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
