import Constants from "expo-constants";
import { Platform } from "react-native";

import { needsExplicitSiteUrl } from "@/lib/convex-site";

/**
 * Startup environment check. Returns human-readable problems instead of
 * letting the app limp along with a blank map or a dead backend connection.
 * Rendered by the gate in src/app/_layout.tsx.
 */
export function getEnvProblems(): string[] {
  const problems: string[] = [];

  // Map keys are compiled into the native binary; if the flag says the key
  // was absent at build time, the map will render blank with no error.
  const mapKeys = Constants.expoConfig?.extra?.googleMapsKeyPresent as
    | { android: boolean; ios: boolean }
    | undefined;
  if (Platform.OS === "android" && !mapKeys?.android) {
    problems.push(
      "GOOGLE_MAPS_API_KEY_ANDROID was missing when this build was made. Set it in .env (or EAS env vars) and rebuild.",
    );
  }
  if (Platform.OS === "ios" && !mapKeys?.ios) {
    problems.push(
      "GOOGLE_MAPS_API_KEY_IOS was missing when this build was made. Set it in .env (or EAS env vars) and rebuild.",
    );
  }

  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    problems.push(
      "EXPO_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and copy the URL into .env.",
    );
  } else if (!process.env.EXPO_PUBLIC_CONVEX_SITE_URL && needsExplicitSiteUrl(convexUrl)) {
    // Photo uploads go to the HTTP-actions host, which only follows from the
    // cloud URL for default *.convex.cloud deployments.
    problems.push(
      "EXPO_PUBLIC_CONVEX_SITE_URL is not set. Custom Convex domains need the HTTP actions URL configured explicitly in .env.",
    );
  }
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    problems.push(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy it from the Clerk Dashboard into .env.",
    );
  }

  return problems;
}
