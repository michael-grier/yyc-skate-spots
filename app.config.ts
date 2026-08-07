import { ConfigContext, ExpoConfig } from "expo/config";

// Google Maps keys are baked into the native binaries at build time.
// A build with a missing key does NOT error — it just renders a blank/gray
// map — so we fail the EAS build instead of letting that happen.
const GOOGLE_MAPS_API_KEY_ANDROID = process.env.GOOGLE_MAPS_API_KEY_ANDROID;
const GOOGLE_MAPS_API_KEY_IOS = process.env.GOOGLE_MAPS_API_KEY_IOS;

const isEasBuild = process.env.EAS_BUILD === "true";

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

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "YYC Skate Spots",
  slug: "yyc-skate-spots",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "yycskatespots",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.yycskatespots.app",
    icon: "./assets/expo.icon",
    config: {
      googleMapsApiKey: GOOGLE_MAPS_API_KEY_IOS,
    },
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
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    config: {
      googleMaps: {
        apiKey: GOOGLE_MAPS_API_KEY_ANDROID,
      },
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@clerk/expo",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
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
        photosPermission:
          "YYC Skate Spots lets you attach photos of a spot when you submit it.",
        cameraPermission:
          "YYC Skate Spots lets you photograph a spot when you submit it.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Runtime-visible flags so the app can fail loudly on a bad build
    // instead of showing a silently blank map (see src/lib/env.ts).
    googleMapsKeyPresent: {
      android: Boolean(GOOGLE_MAPS_API_KEY_ANDROID),
      ios: Boolean(GOOGLE_MAPS_API_KEY_IOS),
    },
  },
});
