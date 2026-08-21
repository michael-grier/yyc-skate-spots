import { useAuth } from "@clerk/expo";
import { ActivityIndicator, View } from "react-native";

import { ProfileView } from "@/components/profile-view";
import { SignInView } from "@/components/sign-in-view";
import { colors } from "@/theme/colors";

/**
 * Account tab: sign-in when signed out, profile when signed in. Clerk state
 * here only decides what to show; every protected write is re-checked in
 * Convex against the session token.
 */
export default function AccountScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color={colors.mute} />
      </View>
    );
  }

  return isSignedIn ? <ProfileView /> : <SignInView />;
}
