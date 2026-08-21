import { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { BoardMark } from "@/components/board-mark";
import { CALGARY_CENTER, type LatLng } from "@/lib/geo";
import { useUserLocation } from "@/lib/use-user-location";
import { darkMapStyle } from "@/theme/map-style";

// Block-scale framing: tight enough to place a pin on the right ledge.
const PICK_DELTA = 0.004;

type LocationPickerProps = {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
};

/** Drag-the-map pin placement; the pin is fixed at the map's centre. */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapRef = useRef<MapView>(null);
  const { coords } = useUserLocation();
  const centredOnUser = useRef(false);

  // For a new spot, jump to the user once their position is known and adopt
  // it as the default — most spots are added from the spot itself.
  useEffect(() => {
    if (value || !coords || centredOnUser.current) {
      return;
    }
    centredOnUser.current = true;
    mapRef.current?.animateToRegion(
      { ...coords, latitudeDelta: PICK_DELTA, longitudeDelta: PICK_DELTA },
      300,
    );
    onChange(coords);
  }, [coords, value, onChange]);

  const initial = value ?? CALGARY_CENTER;

  return (
    <View className="h-[200px] overflow-hidden rounded-2xl border border-white/10">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={darkMapStyle}
        style={{ flex: 1 }}
        initialRegion={{ ...initial, latitudeDelta: PICK_DELTA, longitudeDelta: PICK_DELTA }}
        showsUserLocation={coords !== null}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        // Only a user gesture places the pin; the mount/animation callbacks
        // would otherwise silently "choose" the fallback centre.
        onRegionChangeComplete={(region: Region, details) => {
          if (details?.isGesture) {
            onChange({ latitude: region.latitude, longitude: region.longitude });
          }
        }}
      />
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View
          className="h-9 w-9 items-center justify-center rounded-full border border-white/30"
          style={{ backgroundColor: "rgba(232,234,238,0.95)" }}
        >
          <BoardMark size={16} strokeWidth={2.4} color="#17191D" />
        </View>
      </View>
    </View>
  );
}
