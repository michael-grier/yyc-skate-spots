import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

import { darkMapStyle } from "@/theme/map-style";

// Downtown Calgary, framed wide enough to take in the whole city. Spots are
// scattered city-wide, so opening tighter than this hides most of them.
const CALGARY_REGION = {
  latitude: 51.0447,
  longitude: -114.0719,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

/**
 * The map is the app's landing screen and is browsable signed out. Sign-in is
 * only required for actions that write, which do not exist yet.
 */
export default function MapScreen() {
  return (
    <>
      {/* The map is full-bleed, so the stack header would both crop it and title it "index". */}
      <Stack.Screen options={{ headerShown: false }} />
      <MapView
        provider={PROVIDER_GOOGLE}
        initialRegion={CALGARY_REGION}
        customMapStyle={darkMapStyle}
        style={styles.map}
      />
    </>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
