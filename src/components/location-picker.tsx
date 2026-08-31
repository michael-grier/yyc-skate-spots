import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { BoardMark } from "@/components/board-mark";
import { ChevronDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { CALGARY_CENTER, formatCoordinatePair, type LatLng, parseCoordinatePair } from "@/lib/geo";
import { useUserLocation } from "@/lib/use-user-location";
import { colors } from "@/theme/colors";
import { darkMapStyle } from "@/theme/map-style";

// Block-scale framing: tight enough to place a pin on the right ledge.
const PICK_DELTA = 0.004;

type LocationPickerProps = {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
};

/** Map-first spot placement with a paste-coordinate alternative. */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapRef = useRef<MapView>(null);
  const { coords } = useUserLocation();
  const centredOnUser = useRef(false);
  const formattedValue = value ? formatCoordinatePair(value) : "";
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [coordinateText, setCoordinateText] = useState(formattedValue);
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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

  function toggleCoordinates() {
    if (!coordinatesOpen) {
      setCoordinateText(formattedValue);
    }
    setCoordinateError(null);
    setCoordinatesOpen((open) => !open);
  }

  function setLocationFromMap(region: Region) {
    const next = { latitude: region.latitude, longitude: region.longitude };
    setCoordinateText(formatCoordinatePair(next));
    setCoordinateError(null);
    onChange(next);
  }

  function applyCoordinates() {
    const next = parseCoordinatePair(coordinateText);
    if (!next) {
      setCoordinateError("Use latitude first, like 51.0447, -114.0719.");
      return;
    }

    setCoordinateText(formatCoordinatePair(next));
    setCoordinateError(null);
    onChange(next);
    mapRef.current?.animateToRegion(
      { ...next, latitudeDelta: PICK_DELTA, longitudeDelta: PICK_DELTA },
      300,
    );
  }

  const initial = value ?? CALGARY_CENTER;

  return (
    <View>
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
              setLocationFromMap(region);
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
      <Text className="mt-1.5 px-1 font-sans text-[12px] text-mute">
        Drag the map until the pin sits on the spot.
      </Text>

      <Card className="mt-4 overflow-hidden">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: coordinatesOpen }}
          onPress={toggleCoordinates}
          className="flex-row items-center justify-between px-4 py-3.5 active:opacity-80"
        >
          <View className="flex-1 pr-3">
            <Text className="font-sans-semibold text-[13px] text-silver">
              Or paste coordinates instead
            </Text>
            <Text className="mt-1 font-sans text-[11px] text-mute">
              Use a location copied from another map.
            </Text>
          </View>
          <View style={{ transform: [{ rotate: coordinatesOpen ? "180deg" : "0deg" }] }}>
            <ChevronDownIcon size={16} color={colors.mute} />
          </View>
        </Pressable>

        {coordinatesOpen ? (
          <View className="border-t border-white/10 px-4 pb-4 pt-3">
            <TextInput
              value={coordinateText}
              onChangeText={(text) => {
                setCoordinateText(text);
                setCoordinateError(null);
              }}
              placeholder="51.0447, -114.0719"
              placeholderTextColor={colors.mute}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              selectTextOnFocus
              onSubmitEditing={applyCoordinates}
              accessibilityLabel="Latitude and longitude"
              className={cn(
                "rounded-xl border border-white/10 bg-base px-3.5 py-3 font-sans text-[14px] text-ink",
                !!coordinateError && "border-bust-high/60",
              )}
              // Coordinate pairs need punctuation and optional compass letters,
              // so a numeric keyboard would hide valid input characters.
              style={{ paddingVertical: 12 }}
            />
            {coordinateError ? (
              <Text
                accessibilityRole="alert"
                className="mt-1.5 px-1 font-sans text-[12px] text-bust-high"
              >
                {coordinateError}
              </Text>
            ) : null}
            <Button label="Apply to map" onPress={applyCoordinates} className="mt-3 py-3.5" />
            <Text className="mt-3 font-sans text-[11px] leading-4 text-mute">
              Applying coordinates moves the same pin. You do not need to place it twice.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: helpOpen }}
              onPress={() => setHelpOpen((open) => !open)}
              className="mt-3 self-start active:opacity-80"
            >
              <Text className="font-sans text-[11px] text-silver underline">
                How to copy from Google or Apple Maps
              </Text>
            </Pressable>
            {helpOpen ? (
              <View className="mt-3 rounded-xl bg-base p-3">
                <Text className="font-sans text-[11px] leading-4 text-mute">
                  <Text className="font-sans-semibold text-ink">Google Maps: </Text>
                  Touch and hold an unlabelled spot to drop a pin, swipe up its details, then tap or
                  touch and hold the coordinates to copy them.
                </Text>
                <Text className="mt-2 font-sans text-[11px] leading-4 text-mute">
                  <Text className="font-sans-semibold text-ink">Apple Maps: </Text>
                  Save a pin, open it from Places and Pinned, swipe to Coordinates, then touch and
                  hold to copy.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>
    </View>
  );
}
