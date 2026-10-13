import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClusterMarker } from "@/components/cluster-marker";
import { type FilterSection, FilterChips } from "@/components/filter-chips";
import { FilterSheet } from "@/components/filter-sheet";
import { LocateIcon } from "@/components/icons";
import { SearchBar } from "@/components/search-bar";
import { SearchSuggestions } from "@/components/search-suggestions";
import { SpotMarker } from "@/components/spot-marker";
import { SpotPreviewCard } from "@/components/spot-preview-card";
import { CALGARY_BOUNDS, distanceKm, isInCalgary } from "@/lib/geo";
import { clampRegion, framingAround, paddingAboveKeyboard } from "@/lib/map-math";
import {
  applyFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  fitKeyFor,
  hasActiveFilters,
  rankSuggestions,
} from "@/lib/spot-filters";
import { useAccountGeneration } from "@/lib/use-account-generation";
import { useClusters } from "@/lib/use-clusters";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useUserLocation } from "@/lib/use-user-location";
import { colors } from "@/theme/colors";
import { darkMapStyle } from "@/theme/map-style";

// Downtown Calgary, framed wide enough to take in the whole city. Spots are
// scattered city-wide, so opening tighter than this hides most of them.
const CALGARY_REGION: Region = {
  latitude: 51.0447,
  longitude: -114.0719,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

// Zoomed out this far, the map already spans the whole city.
const MIN_ZOOM = 10;
// Neighbourhood-scale framing used when jumping to the user's position.
const LOCATE_DELTA = 0.03;
// Tightest framing when jumping to one spot from the search list.
const SPOT_DELTA = 0.01;
// Keeps fitted pins clear of the search bar and chips above (below the status
// bar inset) and the locate button and preview card below.
const FIT_PADDING = { top: 170, bottom: 230, left: 48, right: 48 };
// Typing pause before the map re-fits to search results.
const REFIT_DEBOUNCE_MS = 400;

// Shared empty result so the loading state doesn't churn memoized clusters.
const NO_SPOTS: never[] = [];

/**
 * The map is the app's landing screen and is browsable signed out. Sign-in is
 * only required for actions that write.
 */
/** A different account starts from a fresh map, as after a cold start. */
export default function MapScreen() {
  return <MapContent key={useAccountGeneration()} />;
}

function MapContent() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  // undefined while the first result is in flight; the map renders empty
  // behind a loading pill.
  const spotsResult = useQuery(api.spots.list);
  const loading = spotsResult === undefined;
  const allSpots = spotsResult ?? NO_SPOTS;
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Suggestions stay open across the input blurring (tapping a row blurs it
  // first); they close on pick, on a map tap, or when the query is cleared.
  const [searchActive, setSearchActive] = useState(false);
  // Tracked on gesture end rather than every frame; clusters only need to
  // recompute once the map settles.
  const [region, setRegion] = useState(CALGARY_REGION);
  const { coords, granted, locate } = useUserLocation();
  // Fits only include the user while they're in the city the map is locked to.
  const coordsInCity = coords && isInCalgary(coords) ? coords : null;

  const spots = useMemo(() => applyFilters(allSpots, filters, coords), [allSpots, filters, coords]);
  // Stable between renders so useClusters only rebuilds its index when the
  // filtered result actually changes.
  const points = useMemo(
    () => spots.map(({ _id, latitude, longitude }) => ({ id: _id, latitude, longitude })),
    [spots],
  );
  // Cluster items carry plain string ids, hence Set<string>.
  const mineIds = useMemo(
    () => new Set<string>(spots.filter((spot) => spot.isMine).map((spot) => spot._id)),
    [spots],
  );
  const { items, regionToExpand } = useClusters(points, region);
  const spotsById = useMemo(
    () => new Map(spots.map((spot) => [spot._id as string, spot])),
    [spots],
  );
  const selectedSpot = spots.find((spot) => spot._id === selectedId);
  const query = filters.query.trim();
  const suggestions = useMemo(
    () =>
      rankSuggestions(spots, coords).map((spot) => ({
        ...spot,
        distanceKm: coords ? distanceKm(coords, spot) : undefined,
      })),
    [spots, coords],
  );

  // Re-frame the map so every matching spot (and the user) is on screen once
  // the filters settle; without this a narrow search could leave the viewport
  // looking empty while matches sat just off-screen. The key is null when
  // there is nothing to frame, so results arriving later still trigger a fit,
  // and it includes the user's location so a later fix re-frames to include them.
  const settledFilters = useDebouncedValue(filters, REFIT_DEBOUNCE_MS);
  const fitKey = fitKeyFor(settledFilters, coords, spots.length);
  const lastFitKeyRef = useRef<string | null>(null);
  // Read when a fit runs, so they're refs rather than state that would re-render.
  const mapHeightRef = useRef(0);
  const chromeBottomRef = useRef(0);
  useEffect(() => {
    if (fitKey === null) {
      lastFitKeyRef.current = null;
      return;
    }
    if (lastFitKeyRef.current === fitKey) {
      return;
    }
    lastFitKeyRef.current = fitKey;
    const padding = { ...FIT_PADDING, top: insets.top + FIT_PADDING.top };
    const keyboard = Keyboard.metrics();
    mapRef.current?.fitToCoordinates(
      [
        ...spots.map(({ latitude, longitude }) => ({ latitude, longitude })),
        ...(coordsInCity ? [coordsInCity] : []),
      ],
      {
        // Results refit as the user types, so they must also clear the
        // suggestion list and the keyboard. The map starts at the window's top
        // edge, so the keyboard's screen position is a map position.
        edgePadding: keyboard
          ? paddingAboveKeyboard(padding, {
              mapHeight: mapHeightRef.current,
              chromeBottom: chromeBottomRef.current,
              keyboardTop: keyboard.screenY,
            })
          : padding,
        animated: true,
      },
    );
  }, [fitKey, spots, coordsInCity, insets.top]);

  /** Closes search so the keyboard cannot cover the preview card that opens at the bottom. */
  function closeSearch() {
    Keyboard.dismiss();
    setSearchActive(false);
  }

  function pickSuggestion(id: string) {
    const spot = spotsById.get(id);
    if (!spot) {
      return;
    }
    closeSearch();
    setSelectedId(id);
    // A pick inside the typing debounce would otherwise be overridden by the
    // results fit landing a moment later.
    lastFitKeyRef.current = fitKeyFor(filters, coords, spots.length);
    mapRef.current?.fitToCoordinates(framingAround(spot, SPOT_DELTA, coordsInCity), {
      edgePadding: { ...FIT_PADDING, top: insets.top + FIT_PADDING.top },
      animated: true,
    });
  }

  function openFilters(section: FilterSection) {
    // A radius is meaningless without a position, so ask as the sheet opens.
    if (section === "distance" && !coords) {
      void locate();
    }
    sheetRef.current?.present();
  }

  async function handleLocate() {
    const position = await locate();
    if (position && !isInCalgary(position)) {
      Alert.alert(
        "Outside Calgary",
        "The map only covers Calgary, so it can't show where you are.",
      );
      return;
    }
    // With a search or filter active, the results-fit effect frames the
    // user together with the matches; animating here too would fight it.
    if (position && !hasActiveFilters(filters)) {
      mapRef.current?.animateToRegion(
        { ...position, latitudeDelta: LOCATE_DELTA, longitudeDelta: LOCATE_DELTA },
        400,
      );
    }
  }

  return (
    <View
      className="flex-1"
      onLayout={(event) => {
        mapHeightRef.current = event.nativeEvent.layout.height;
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={CALGARY_REGION}
        customMapStyle={darkMapStyle}
        style={styles.map}
        showsUserLocation={granted}
        showsMyLocationButton={false}
        minZoomLevel={MIN_ZOOM}
        onRegionChangeComplete={(next, { isGesture }) => {
          setRegion(next);
          // setMapBoundaries is a no-op under the new architecture in
          // react-native-maps 1.27, so a pan out of the city is pulled back
          // once it settles. Only gestures can leave; fits frame city points.
          if (!isGesture) {
            return;
          }
          const inside = clampRegion(next, CALGARY_BOUNDS);
          if (inside.latitude !== next.latitude || inside.longitude !== next.longitude) {
            mapRef.current?.animateToRegion(inside, 250);
          }
        }}
        onPress={(event) => {
          // Belt and braces with the markers' stopPropagation: ignore the
          // synthetic map press that accompanies a marker tap.
          if ((event.nativeEvent as { action?: string }).action !== "marker-press") {
            setSelectedId(null);
            closeSearch();
          }
        }}
      >
        {items.map((item) =>
          item.kind === "cluster" ? (
            <ClusterMarker
              key={`cluster-${item.id}`}
              {...item}
              onPress={() => {
                closeSearch();
                mapRef.current?.animateToRegion(regionToExpand(item), 300);
              }}
            />
          ) : (
            <SpotMarker
              key={item.id}
              {...item}
              selected={item.id === selectedId}
              mine={mineIds.has(item.id)}
              label={query ? spotsById.get(item.id)?.name : undefined}
              // Markers stop the map's own press, so they close search themselves.
              onPress={(id) => {
                closeSearch();
                setSelectedId(id);
              }}
            />
          ),
        )}
      </MapView>

      <View
        className="absolute inset-x-4 gap-3"
        style={{ top: insets.top + 8 }}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          chromeBottomRef.current = y + height;
        }}
      >
        <SearchBar
          value={filters.query}
          onChangeText={(next) => {
            setFilters((current) => ({ ...current, query: next }));
            setSearchActive(next.trim().length > 0);
          }}
          onFocus={() => setSearchActive(query.length > 0)}
          onSubmitEditing={() => setSearchActive(false)}
        />
        {/* While loading, the pill below explains the empty map; an empty
            suggestions list would wrongly read as "no matches". */}
        {!loading && searchActive && query ? (
          <SearchSuggestions
            suggestions={suggestions}
            onPick={pickSuggestion}
            // Only chip filters are worth clearing here; the query has its own ✕.
            onClearFilters={
              countActiveFilters(filters) > 0
                ? () => setFilters((current) => ({ ...DEFAULT_FILTERS, query: current.query }))
                : undefined
            }
          />
        ) : (
          <FilterChips filters={filters} onOpen={openFilters} />
        )}
        {loading ? (
          <View
            className="flex-row items-center gap-2 self-start rounded-full border border-white/10 px-3.5 py-2"
            style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
          >
            <ActivityIndicator size="small" color={colors.mute} />
            <Text className="font-sans text-[12px] text-mute">Loading spots…</Text>
          </View>
        ) : null}
        {!loading && !searchActive && hasActiveFilters(filters) && spots.length === 0 ? (
          <View
            className="flex-row items-center gap-3 self-start rounded-full border border-white/10 px-3.5 py-2"
            style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
          >
            <Text className="font-sans text-[12px] text-mute">No spots match.</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setFilters(DEFAULT_FILTERS)}
            >
              <Text className="font-sans-semibold text-[12px] text-silver">Clear filters</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="absolute inset-x-4 bottom-4 gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show my location"
          onPress={handleLocate}
          className="h-11 w-11 items-center justify-center self-end rounded-full border border-white/10 active:opacity-80"
          style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
        >
          <LocateIcon size={18} color={colors.ink} />
        </Pressable>
        {selectedSpot ? (
          <SpotPreviewCard
            name={selectedSpot.name}
            types={selectedSpot.types}
            bustFactor={selectedSpot.bustFactor}
            previewPhotoUrl={selectedSpot.previewPhotoUrl}
            distanceKm={coords ? distanceKm(coords, selectedSpot) : undefined}
            mine={selectedSpot.isMine}
            onPress={() =>
              router.push({ pathname: "/spot/[id]", params: { id: selectedSpot._id } })
            }
          />
        ) : null}
      </View>

      <FilterSheet
        ref={sheetRef}
        filters={filters}
        onChange={setFilters}
        resultCount={spots.length}
        hasLocation={coords !== null}
        onRequestLocation={() => void locate()}
        onDone={() => sheetRef.current?.dismiss()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
