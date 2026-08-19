import { ClerkProvider } from "@clerk/expo";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text } from "react-native";

import { getEnvProblems } from "@/lib/env";
import { colors } from "@/theme/colors";
import "../global.css";

const publishableKey: string = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

// Evaluated once at startup: a misconfigured environment shows this screen
// instead of a silently blank map or a hung backend connection.
const envProblems = getEnvProblems();

function EnvProblemScreen() {
  return (
    <ScrollView contentContainerClassName="flex-grow justify-center bg-red-950 p-6">
      <Text className="mb-4 text-2xl font-bold text-white">Environment not configured</Text>
      {envProblems.map((problem) => (
        <Text key={problem} className="mb-3 text-base text-red-100">
          • {problem}
        </Text>
      ))}
      <Text className="mt-4 text-sm text-red-300">
        See the setup checklist in README.md, then restart the dev server (or rebuild for map keys).
      </Text>
    </ScrollView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Checked before the font gate so a broken env still fails loudly, in the
  // system font, even if font loading were to hang.
  if (envProblems.length > 0) {
    return <EnvProblemScreen />;
  }

  // The splash screen stays up until the first real render.
  if (!fontsLoaded) {
    return null;
  }

  // TODO(Phase 1): also wrap in ConvexProviderWithClerk.
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.base },
          headerStyle: { backgroundColor: colors.base },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
        }}
      />
    </ClerkProvider>
  );
}
