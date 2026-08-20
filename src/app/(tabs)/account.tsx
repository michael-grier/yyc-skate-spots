import { Text, View } from "react-native";

/** Placeholder until the custom sign-in flow lands (Phase 5). */
export default function AccountScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-base px-8">
      <Text className="font-sans-semibold text-[17px] text-ink">Sign in</Text>
      <Text className="mt-2 text-center font-sans text-[14px] text-mute">
        Sign-in is coming soon. Browsing never needs an account.
      </Text>
    </View>
  );
}
