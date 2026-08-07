import Constants from "expo-constants";
import { Platform } from "react-native";

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
      "GOOGLE_MAPS_API_KEY_ANDROID was missing when this build was made. Set it in .env (or EAS env vars) and rebuild."
    );
  }
  if (Platform.OS === "ios" && !mapKeys?.ios) {
    problems.push(
      "GOOGLE_MAPS_API_KEY_IOS was missing when this build was made. Set it in .env (or EAS env vars) and rebuild."
    );
  }

  if (!process.env.EXPO_PUBLIC_CONVEX_URL) {
    problems.push("EXPO_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and copy the URL into .env.");
  }
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    problems.push(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy it from the Clerk Dashboard into .env."
    );
  }

  return problems;
}
