import { api } from "@convex/_generated/api";
import { DISPLAY_NAME_HINT, displayNameError } from "@convex/displayNames";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useRef, useState } from "react";
import {
  Keyboard,
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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";

type DisplayNameSheetProps = {
  initialName: string;
  onClose: () => void;
};

/** Mounted for each edit so Cancel discards the draft and reopening uses the saved name. */
export function DisplayNameSheet({ initialName, onClose }: DisplayNameSheetProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const saving = useRef(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const setDisplayName = useMutation(api.profiles.setDisplayName);

  function close() {
    if (saving.current) return;
    Keyboard.dismiss();
    onClose();
  }

  async function save() {
    if (saving.current) return;
    const validationError = displayNameError(name);
    setError(validationError);
    if (validationError) return;
    saving.current = true;
    setIsSaving(true);
    try {
      await setDisplayName({ displayName: name.trim().normalize("NFC") });
      Keyboard.dismiss();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof ConvexError && typeof failure.data === "string"
          ? failure.data
          : "Couldn't save your name. Check your connection and try again.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={close}
      onShow={() => inputRef.current?.focus()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end bg-black/65"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel display name edit"
          onPress={close}
          disabled={isSaving}
          className="absolute inset-0"
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={close}
          className="shrink rounded-t-[28px] border-t border-white/15 bg-card"
          style={{ maxHeight: "90%", marginTop: insets.top + 12 }}
        >
          <View className="px-5 pt-3">
            <View className="mx-auto h-1 w-9 rounded-full bg-white/20" />
            <Text
              accessibilityRole="header"
              className="mb-3 mt-5 font-sans-semibold text-[20px] text-ink"
            >
              Edit display name
            </Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
          >
            <Text className="mb-5 font-sans text-[13px] leading-relaxed text-mute">
              Shown beside the spots you contribute. Changing it updates your name on existing spots
              too.
            </Text>
            <Text className="mb-2 font-sans-medium text-[13px] text-silver">Display name</Text>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Display name"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setError(null);
              }}
              editable={!isSaving}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="off"
              placeholder="Choose a display name"
              placeholderTextColor={colors.mute}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => void save()}
              className={cn(
                "rounded-xl border border-white/15 bg-base px-3.5 font-sans text-[16px] text-ink",
                !!error && "border-bust-high/60",
              )}
              style={{ paddingVertical: 14 }}
            />
            <Text className="mt-2 font-sans text-[11px] leading-relaxed text-mute">
              {DISPLAY_NAME_HINT}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" className="mt-2 font-sans text-[13px] text-bust-high">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          {/* Keep both actions above the keyboard even when large text needs to scroll. */}
          <View
            className="flex-row gap-3 px-5 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Button label="Cancel" onPress={close} disabled={isSaving} className="flex-1 bg-card" />
            <Button
              label={isSaving ? "Saving…" : "Save name"}
              onPress={() => void save()}
              disabled={isSaving}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
