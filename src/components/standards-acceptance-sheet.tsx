import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";

type StandardsAcceptanceSheetProps = {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onAgree: () => void;
  onReadFullStandards: () => void;
};

/** One-time agreement shown after a valid first contribution reaches Save. */
export function StandardsAcceptanceSheet({
  visible,
  submitting,
  onClose,
  onAgree,
  onReadFullStandards,
}: StandardsAcceptanceSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
    >
      <View className="flex-1 justify-end bg-black/65">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close community standards"
          disabled={submitting}
          onPress={onClose}
          className="flex-1"
        />
        <View
          accessibilityViewIsModal
          className="rounded-t-[30px] border-t border-white/15 bg-base px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mx-auto h-1 w-10 rounded-full bg-white/20" />
          <Text className="mt-5 font-sans-semibold text-[12px] uppercase tracking-widest text-bust-low">
            First contribution
          </Text>
          <Text className="mt-2 font-sans-semibold text-[23px] tracking-tight text-ink">
            Keep the map useful
          </Text>
          <Text className="mt-2 font-sans text-[14px] leading-relaxed text-mute">
            Before you submit, agree to the rules that keep public spots safe and useful.
          </Text>
          <View className="mt-5 gap-3">
            {[
              "Post real, accurate, shareable skate spots.",
              "Keep names, notes, and photos relevant.",
              "Do not post harassment, explicit content, spam, or private locations.",
              "Only share photos you took or have permission to use.",
            ].map((rule) => (
              <View key={rule} className="flex-row gap-3">
                <Text className="font-sans-semibold text-[14px] text-bust-low">✓</Text>
                <Text className="flex-1 font-sans text-[14px] leading-[20px] text-ink">{rule}</Text>
              </View>
            ))}
          </View>
          <Button
            label={submitting ? "Submitting…" : "Agree and submit"}
            variant="light"
            disabled={submitting}
            onPress={onAgree}
            className="mt-5"
          />
          <Pressable
            accessibilityRole="link"
            disabled={submitting}
            onPress={onReadFullStandards}
            className="items-center py-3 active:opacity-80"
          >
            <Text className="font-sans-semibold text-[14px] text-silver">
              Read the full standards
            </Text>
          </Pressable>
          <Text className="text-center font-sans text-[11px] text-mute">
            This agreement is saved to your account and is not shown again.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
