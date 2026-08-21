import { useClerk, useUser } from "@clerk/expo";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function initialsOf(name: string | null | undefined, email: string | undefined) {
  const source = name?.trim() || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** Signed-in state of the Account tab. */
export function ProfileView() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <View className="flex-1 bg-base px-5" style={{ paddingTop: insets.top + 24 }}>
      <Text className="font-sans-semibold text-[26px] tracking-tight text-ink">Profile</Text>

      <Card className="mt-6 flex-row items-center gap-4 p-4">
        <View className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <Text className="font-sans-semibold text-[15px] text-silver">
            {initialsOf(user?.fullName, email)}
          </Text>
        </View>
        <View className="flex-1">
          {user?.fullName ? (
            <Text numberOfLines={1} className="font-sans-semibold text-[16px] text-ink">
              {user.fullName}
            </Text>
          ) : null}
          {email ? (
            <Text numberOfLines={1} className="font-sans text-[13px] text-mute">
              {email}
            </Text>
          ) : null}
        </View>
      </Card>

      <Button label="Sign out" onPress={() => void signOut()} className="mt-6" />
    </View>
  );
}
