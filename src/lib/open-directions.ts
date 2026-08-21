import { Linking, Platform } from "react-native";

import { type Destination, GOOGLE_MAPS_SCHEME, directionsUrl } from "@/lib/directions";

/** Hands the spot off to the device's maps app for turn-by-turn. */
export async function openDirections(destination: Destination) {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const googleMapsInstalled =
    platform === "ios" ? await Linking.canOpenURL(GOOGLE_MAPS_SCHEME).catch(() => false) : false;
  await Linking.openURL(directionsUrl(platform, destination, googleMapsInstalled));
}
