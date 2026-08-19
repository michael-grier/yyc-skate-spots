import { ClerkProvider } from "@clerk/expo";
import { Stack } from "expo-router";
import { ScrollView, Text } from "react-native";

import { getEnvProblems } from "@/lib/env";
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
  if (envProblems.length > 0) {
    return <EnvProblemScreen />;
  }

  // TODO(Phase 2): also wrap in ConvexProviderWithClerk.
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <Stack />
    </ClerkProvider>
  );
}
