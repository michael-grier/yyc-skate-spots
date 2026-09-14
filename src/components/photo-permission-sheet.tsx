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
            No photos yet. Can the admin help?
          </Text>
          <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
            Allow the admin to add photos to this spot when they can. This gives permission, but
            does not guarantee photos.
          </Text>
          <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
            The admin cannot change your spot details. You can withdraw permission from your spot.
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
