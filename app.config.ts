import type { ConfigContext, ExpoConfig } from "expo/config";

// Google Maps keys are baked into the native binaries at build time.
// A build with a missing key does NOT error — it just renders a blank/gray
// map — so we fail the EAS build instead of letting that happen.
const GOOGLE_MAPS_API_KEY_ANDROID = process.env.GOOGLE_MAPS_API_KEY_ANDROID;
const GOOGLE_MAPS_API_KEY_IOS = process.env.GOOGLE_MAPS_API_KEY_IOS;
const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_BASE_URL;

const isEasBuild = process.env.EAS_BUILD === "true";

function shareHost(baseUrl: string | undefined): string | null {
  if (!baseUrl) {
    return null;
  }
  try {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

const SHARE_HOST = shareHost(SHARE_BASE_URL);

for (const [name, value] of [
  ["GOOGLE_MAPS_API_KEY_ANDROID", GOOGLE_MAPS_API_KEY_ANDROID],
  ["GOOGLE_MAPS_API_KEY_IOS", GOOGLE_MAPS_API_KEY_IOS],
] as const) {
  if (!value) {
    const message = `${name} is not set. Copy .env.example to .env and follow the "Google Maps API keys" section of the README.`;
    if (isEasBuild) {
      throw new Error(message);
    }
    console.warn(`⚠️  ${message}`);
  }
}

if (!SHARE_HOST) {
  const message =
    "EXPO_PUBLIC_SHARE_BASE_URL must be an HTTPS origin without a path. See the share links section of README.md.";
  if (isEasBuild) {
    throw new Error(message);
  }
  console.warn(message);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "YYC Skate Spots",
  slug: "yyc-skate-spots",
  // Pinned explicitly because this user owns more than one Expo account;
  // without `owner`, EAS infers it from login context and can resolve to the
  // wrong one (notably in CI, where there is no interactive session).
  owner: "michaelgrier",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "yycskatespots",
  userInterfaceStyle: "dark",
  ios: {
    bundleIdentifier: "com.yycskatespots.app",
    usesAppleSignIn: true,
    associatedDomains: SHARE_HOST ? [`applinks:${SHARE_HOST}`] : [],
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "YYC Skate Spots shows your position on the map and sorts spots by distance from you.",
      // Required for Linking.canOpenURL("comgooglemaps://") in the
      // directions helper — without this entry iOS always reports the
      // Google Maps app as not installed.
      LSApplicationQueriesSchemes: ["comgooglemaps"],
    },
  },
  android: {
    package: "com.yycskatespots.app",
    adaptiveIcon: {
      backgroundColor: "#141517",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    // Keys must go through react-native-maps' own plugin, not the legacy
    // `ios.config.googleMapsApiKey` / `android.config.googleMaps` fields.
    // Those fields make Expo's built-in fallback plugin write
    // `pod 'react-native-google-maps'` into the Podfile, and that podspec no
    // longer exists in react-native-maps 1.27 — Google Maps is now the
    // `react-native-maps/Google` subspec, which only this plugin adds.
    [
      "react-native-maps",
      {
        iosGoogleMapsApiKey: GOOGLE_MAPS_API_KEY_IOS,
        androidGoogleMapsApiKey: GOOGLE_MAPS_API_KEY_ANDROID,
      },
    ],
    "expo-secure-store",
    "expo-apple-authentication",
    "@clerk/expo",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#141517",
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "YYC Skate Spots shows your position on the map and sorts spots by distance from you.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "YYC Skate Spots lets you attach photos of a spot when you submit it.",
        cameraPermission: "YYC Skate Spots lets you photograph a spot when you submit it.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "c70e46c5-1b1d-43d6-b8d0-dd48cd050273",
    },
    // Runtime-visible flags so the app can fail loudly on a bad build
    // instead of showing a silently blank map (see src/lib/env.ts).
    googleMapsKeyPresent: {
      android: Boolean(GOOGLE_MAPS_API_KEY_ANDROID),
      ios: Boolean(GOOGLE_MAPS_API_KEY_IOS),
    },
  },
});
