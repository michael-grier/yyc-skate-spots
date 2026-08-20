import { Text, View } from "react-native";

/** Placeholder until the add-spot flow lands (Phase 6). */
export default function AddSpotScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base px-8">
      <Text className="font-sans-semibold text-[17px] text-ink">Add spot</Text>
      <Text className="mt-2 text-center font-sans text-[14px] text-mute">
        Submitting spots is coming soon.
      </Text>
    </View>
  );
}
