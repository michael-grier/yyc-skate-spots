import { StatusBar } from "expo-status-bar";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardMark } from "@/components/board-mark";
import { BackIcon, ClipboardIcon, LocateIcon, MapIcon, PinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { CALGARY_CENTER, formatCoordinatePair, type LatLng, parseCoordinatePair } from "@/lib/geo";
import { useUserLocation } from "@/lib/use-user-location";
import { colors } from "@/theme/colors";
import { darkMapStyle } from "@/theme/map-style";

// Block-scale framing: tight enough to place a pin on the right ledge.
const PICK_DELTA = 0.004;

const PREVIEW_HEIGHT = 160;

type LocationPickerProps = {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  /**
   * "expanded" shows a map preview with every method laid out, for the add
   * wizard step that is only about location. "compact" collapses to a summary
   * row that opens the methods on tap, for the edit form.
   */
  variant?: "expanded" | "compact";
};

type LocationMethodButtonProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
};

function LocationMethodButton({
  label,
  icon,
  onPress,
  disabled,
  expanded,
}: LocationMethodButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, expanded }}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-white/15 bg-ctagrey px-2.5 py-3 active:opacity-80",
        disabled && "opacity-40",
      )}
    >
      {icon}
      <Text numberOfLines={2} className="shrink font-sans-semibold text-[12px] leading-4 text-ink">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The map pin, dropped on the centre of whatever it overlays — the full-screen
 * picker and the inline preview both aim at the middle of their map.
 *
 * It is one SVG outline rather than a disc stacked on a rotated square: stacked
 * views cannot share an edge, so whichever paints last cuts a gap through the
 * other's white ring. The tail meets the head at its tangent points, which is
 * what makes the join read as a single teardrop at any size.
 */
function CenterPin({ size = 44 }: { size?: number }) {
  const radius = size / 2;
  const ring = Math.max(2, size * 0.1);
  const tip = radius * 1.9;
  // Where the tangent lines from the tip touch the head.
  const tangentX = radius * Math.sqrt(1 - (radius / tip) ** 2);
  const tangentY = radius ** 2 / tip;
  // Half the stroke sits outside the path, so inset the head by that much.
  const center = radius + ring / 2;
  const width = size + ring;
  const height = radius + tip + ring;
  const board = size * 0.42;

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center">
      <View
        // The stroke overhangs the tip by half its width, so drop the box by
        // that much to land the point itself on the centre.
        style={{ position: "absolute", bottom: "50%", marginBottom: -ring / 2, width, height }}
      >
        <Svg width={width} height={height}>
          <Path
            d={[
              `M ${center} ${center + tip}`,
              `L ${center - tangentX} ${center + tangentY}`,
              `A ${radius} ${radius} 0 1 1 ${center + tangentX} ${center + tangentY}`,
              "Z",
            ].join(" ")}
            fill={colors.pinSelectedInk}
            stroke="#fff"
            strokeWidth={ring}
          />
        </Svg>
        <View style={{ position: "absolute", left: center - board / 2, top: center - board / 2 }}>
          <BoardMark size={board} strokeWidth={2.4} color={colors.ink} />
        </View>
      </View>
    </View>
  );
}

/** Explicit GPS, coordinate, and full-screen map methods for setting one spot location. */
export function LocationPicker({ value, onChange, variant = "expanded" }: LocationPickerProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { coords, locate } = useUserLocation();
  const [mapOpen, setMapOpen] = useState(false);
  const [mapStart, setMapStart] = useState(value ?? CALGARY_CENTER);
  const [mapDraft, setMapDraft] = useState(value ?? CALGARY_CENTER);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [locating, setLocating] = useState(false);
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [coordinateText, setCoordinateText] = useState(value ? formatCoordinatePair(value) : "");
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Only the compact summary row reads this; the expanded variant renders the
  // methods unconditionally and never toggles.
  const [methodsOpen, setMethodsOpen] = useState(false);

  function setLocation(next: LatLng) {
    setCoordinateText(formatCoordinatePair(next));
    setCoordinateError(null);
    onChange(next);
  }

  async function requestCurrentLocation() {
    setLocating(true);
    try {
      const next = await locate();
      if (!next) {
        Alert.alert("Location unavailable", "Allow location access or choose the spot on the map.");
      }
      return next;
    } catch {
      Alert.alert("Location unavailable", "Check location services and try again.");
      return null;
    } finally {
      setLocating(false);
    }
  }

  async function handleUseCurrentLocation() {
    const next = await requestCurrentLocation();
    if (next) {
      setLocation(next);
    }
  }

  async function centerMapOnCurrentLocation() {
    const next = await requestCurrentLocation();
    if (!next) {
      return;
    }
    setMapDraft(next);
    mapRef.current?.animateToRegion(
      { ...next, latitudeDelta: PICK_DELTA, longitudeDelta: PICK_DELTA },
      300,
    );
  }

  function openMap() {
    const start = value ?? coords ?? CALGARY_CENTER;
    setMapStart(start);
    setMapDraft(start);
    setCoordinatesOpen(false);
    setMapOpen(true);
  }

  function confirmMapLocation() {
    setLocation(mapDraft);
    setMapOpen(false);
  }

  function toggleCoordinates() {
    if (!coordinatesOpen) {
      setCoordinateText(value ? formatCoordinatePair(value) : "");
    }
    setCoordinateError(null);
    setCoordinatesOpen((open) => !open);
  }

  function applyCoordinates() {
    const next = parseCoordinatePair(coordinateText);
    if (!next) {
      setCoordinateError("Use latitude first, like 51.0447, -114.0719.");
      return;
    }
    setLocation(next);
    setCoordinatesOpen(false);
    setHelpOpen(false);
  }

  const formattedValue = value ? formatCoordinatePair(value) : null;

  const methods = (
    <>
      <Button
        label={formattedValue ? "Move the pin on the map" : "Choose on map"}
        variant="light"
        icon={<MapIcon size={18} color={colors.pinSelectedInk} />}
        onPress={openMap}
        className="py-3.5"
      />
      <View className="mt-2.5 flex-row gap-2.5">
        <LocationMethodButton
          label={locating ? "Locating…" : "Current location"}
          icon={<LocateIcon size={16} color={colors.silver} />}
          onPress={() => void handleUseCurrentLocation()}
          disabled={locating}
        />
        <LocationMethodButton
          label="Paste coordinates"
          icon={<ClipboardIcon size={16} color={colors.silver} />}
          onPress={toggleCoordinates}
          expanded={coordinatesOpen}
        />
      </View>

      {coordinatesOpen ? (
        <View className="mt-4 border-t border-white/10 pt-4">
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
            // A numeric keyboard omits punctuation and compass letters used by valid pairs.
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
          <Button label="Apply location" onPress={applyCoordinates} className="mt-3 py-3.5" />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: helpOpen }}
            onPress={() => setHelpOpen((open) => !open)}
            className="mt-3 self-start py-1 active:opacity-80"
          >
            <Text className="font-sans text-[11px] text-silver underline">
              How to copy coordinates
            </Text>
          </Pressable>
          {helpOpen ? (
            <View className="mt-2 rounded-xl bg-base p-3">
              <Text className="font-sans text-[11px] leading-4 text-mute">
                <Text className="font-sans-semibold text-ink">Google Maps: </Text>
                Touch and hold the spot, open its details, then copy the coordinates.
              </Text>
              <Text className="mt-2 font-sans text-[11px] leading-4 text-mute">
                <Text className="font-sans-semibold text-ink">Apple Maps: </Text>
                Drop a pin, open its details, then touch and hold the coordinates.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <>
      {variant === "expanded" ? (
        <Card className="overflow-hidden">
          {/* A preview answers "is the pin on the right block?" without opening the map. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={formattedValue ? "Change spot location" : "Set spot location"}
            onPress={openMap}
            className="active:opacity-90"
          >
            {value ? (
              <View style={{ height: PREVIEW_HEIGHT }}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  customMapStyle={darkMapStyle}
                  style={{ flex: 1 }}
                  region={{ ...value, latitudeDelta: PICK_DELTA, longitudeDelta: PICK_DELTA }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  toolbarEnabled={false}
                  // Android renders a static bitmap in lite mode, which is all a preview needs.
                  liteMode
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                {/* React Native only honours pointerEvents on its own view classes,
                    and the Android MapView extends the Google Maps one, so it would
                    swallow this tap. A plain view on top takes it to the Pressable. */}
                <View className="absolute inset-0" />
                <CenterPin size={30} />
              </View>
            ) : (
              <View
                className="items-center justify-center bg-base"
                style={{ height: PREVIEW_HEIGHT }}
              >
                <PinIcon size={22} color={colors.mute} />
                <Text className="mt-2 font-sans text-[13px] text-mute">No location set</Text>
              </View>
            )}
          </Pressable>

          <View className="border-t border-white/10 p-4">
            {/* The preview above already says when nothing is set, and the step
                heading already asks the question, so only repeat the coordinates. */}
            {formattedValue ? (
              <>
                <Text className="font-sans-semibold text-[14px] text-ink">Location set</Text>
                <Text className="mt-1 font-sans text-[12px] leading-[18px] text-mute">
                  {formattedValue}
                </Text>
              </>
            ) : (
              <Text className="font-sans text-[12px] leading-[18px] text-mute">
                Choose the quickest method for this spot.
              </Text>
            )}
            <View className="mt-4">{methods}</View>
          </View>
        </Card>
      ) : (
        <Card className="p-4">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: methodsOpen }}
            accessibilityLabel={formattedValue ? "Change spot location" : "Set spot location"}
            onPress={() => setMethodsOpen((open) => !open)}
            className="flex-row items-center gap-3 active:opacity-80"
          >
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <PinIcon size={19} color={colors.silver} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-[14px] text-ink">
                {formattedValue ? "Location set" : "No location set"}
              </Text>
              <Text className="mt-0.5 font-sans text-[12px] text-mute">
                {formattedValue ?? "Choose the quickest method for this spot."}
              </Text>
            </View>
            <Text className="font-sans-semibold text-[13px] text-silver">
              {methodsOpen ? "Close" : "Change"}
            </Text>
          </Pressable>
          {methodsOpen ? (
            <View className="mt-4 border-t border-white/10 pt-4">{methods}</View>
          ) : null}
        </Card>
      )}

      {mapOpen ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setMapOpen(false)}
        >
          <View className="flex-1 bg-base" accessibilityViewIsModal>
            <StatusBar style="dark" />
            <View className="flex-1">
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                mapType={mapType}
                style={{ flex: 1 }}
                initialRegion={{
                  ...mapStart,
                  latitudeDelta: PICK_DELTA,
                  longitudeDelta: PICK_DELTA,
                }}
                showsUserLocation={coords !== null}
                showsMyLocationButton={false}
                toolbarEnabled={false}
                accessibilityLabel="Choose spot location on map"
                onRegionChangeComplete={(region: Region) => {
                  setMapDraft({ latitude: region.latitude, longitude: region.longitude });
                }}
              />

              <View
                className="absolute inset-x-0 flex-row items-center justify-between px-4 pb-3"
                style={{
                  paddingTop: insets.top + 8,
                  backgroundColor: "rgba(255,255,255,0.92)",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close map"
                  hitSlop={8}
                  onPress={() => setMapOpen(false)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white active:opacity-80"
                >
                  <BackIcon size={19} color={colors.pinSelectedInk} />
                </Pressable>
                <Text className="font-sans-semibold text-[17px] text-pinSelectedInk">
                  Set location
                </Text>
                <View className="h-10 w-10" />
              </View>

              <View
                className="absolute flex-row rounded-full bg-white p-1"
                style={{ top: insets.top + 70, alignSelf: "center", elevation: 4 }}
              >
                {(["standard", "satellite"] as const).map((type) => {
                  const selected = mapType === type;
                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setMapType(type)}
                      className={cn(
                        "rounded-full px-4 py-2 active:opacity-80",
                        selected && "bg-pinSelectedInk",
                      )}
                    >
                      <Text
                        className={cn(
                          "font-sans-semibold text-[12px]",
                          selected ? "text-white" : "text-pinSelectedInk/60",
                        )}
                      >
                        {type === "standard" ? "Map" : "Satellite"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <CenterPin />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Center map on current location"
                onPress={() => void centerMapOnCurrentLocation()}
                disabled={locating}
                className={cn(
                  "absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full bg-white active:opacity-80",
                  locating && "opacity-50",
                )}
                style={{ elevation: 4 }}
              >
                <LocateIcon size={20} color={colors.pinSelectedInk} />
              </Pressable>
            </View>

            <View
              className="rounded-t-[28px] bg-base px-5 pt-5"
              style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
            >
              <View className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20" />
              <Text className="font-sans-semibold text-[16px] text-ink">Pin location</Text>
              <Text className="mt-1 font-sans text-[12px] text-mute">
                {formatCoordinatePair(mapDraft)}
              </Text>
              <Text className="mt-3 font-sans text-[12px] leading-[18px] text-mute">
                Move the map until the pin sits on the spot.
              </Text>
              <Button
                label="Confirm location"
                variant="light"
                onPress={confirmMapLocation}
                className="mt-4"
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
