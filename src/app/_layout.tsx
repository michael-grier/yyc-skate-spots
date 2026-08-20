import { ClerkProvider, useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
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

// Null when EXPO_PUBLIC_CONVEX_URL is unset — the env gate below renders
// before anything can touch the client. unsavedChangesWarning is a
// browser-only feature and must be off in React Native.
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false }) : null;

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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Checked before the font gate so a broken env still fails loudly, in the
  // system font, even if font loading were to hang. The !convex arm is
  // unreachable (a missing URL is an env problem) but narrows the type.
  if (envProblems.length > 0 || !convex) {
    return <EnvProblemScreen />;
  }

  // The splash screen stays up until the first real render. On a font-load
  // failure, render anyway with system fonts instead of hanging on splash.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.base },
            headerStyle: { backgroundColor: colors.base },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
          }}
        />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
