import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";

/** Both explicit choices continue saving; dismissing leaves the form untouched. */
export function PhotoPermissionSheet({
  visible,
  onChoose,
  onClose,
  onDismiss,
}: {
  visible: boolean;
  onChoose: (allowed: boolean) => void;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      testID="photo-permission-sheet"
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View className="flex-1 justify-end bg-black/65">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo permission"
          onPress={onClose}
          className="flex-1"
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          className="rounded-t-[30px] border-t border-white/15 bg-card px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mx-auto h-1 w-10 rounded-full bg-white/20" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo permission"
            onPress={onClose}
            className="mt-2 self-end px-2 py-2"
          >
            <Text className="font-sans text-[14px] text-silver">Cancel</Text>
          </Pressable>
          <Text className="mt-2 font-sans-semibold text-[23px] tracking-tight text-ink">
            No photos yet. Can we help?
          </Text>
          <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
            Photos help other skaters decide which spots are worth visiting, but we know that not
            everyone is always in the position to add them.
          </Text>
          <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
            If you have no photos to add for this spot, consider granting us permission to add some
            for you. If/when we are able, we will travel to this spot, take photos, and upload them
            on your behalf.
          </Text>
          <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
            We cannot add/change anything else about the spot, and you can withdraw photo upload
            permission at any time.
          </Text>
          <Button
            label="Allow and save spot"
            variant="light"
            onPress={() => onChoose(true)}
            className="mt-5"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => onChoose(false)}
            className="items-center py-4 active:opacity-80"
          >
            <Text className="font-sans-semibold text-[14px] text-silver">
              Save without permission
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
