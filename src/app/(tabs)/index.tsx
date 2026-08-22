import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
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
import { distanceKm } from "@/lib/geo";
import {
  applyFilters,
  DEFAULT_FILTERS,
  fitKeyFor,
  hasActiveFilters,
  rankSuggestions,
} from "@/lib/spot-filters";
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

// Neighbourhood-scale framing used when jumping to the user's position.
const LOCATE_DELTA = 0.03;
// Block-scale framing when jumping to one spot from the search list.
const SPOT_DELTA = 0.01;
// Typing pause before the map re-fits to search results.
const REFIT_DEBOUNCE_MS = 400;

// Shared empty result so the loading state doesn't churn memoized clusters.
const NO_SPOTS: never[] = [];

/**
 * The map is the app's landing screen and is browsable signed out. Sign-in is
 * only required for actions that write.
 */
export default function MapScreen() {
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
  useEffect(() => {
    if (fitKey === null) {
      lastFitKeyRef.current = null;
      return;
    }
    if (lastFitKeyRef.current === fitKey) {
      return;
    }
    lastFitKeyRef.current = fitKey;
    mapRef.current?.fitToCoordinates(
      [
        ...spots.map(({ latitude, longitude }) => ({ latitude, longitude })),
        ...(coords ? [coords] : []),
      ],
      {
        edgePadding: { top: insets.top + 170, bottom: 230, left: 48, right: 48 },
        animated: true,
      },
    );
  }, [fitKey, spots, coords, insets.top]);

  function pickSuggestion(id: string) {
    const spot = spotsById.get(id);
    if (!spot) {
      return;
    }
    Keyboard.dismiss();
    setSearchActive(false);
    setSelectedId(id);
    mapRef.current?.animateToRegion(
      {
        latitude: spot.latitude,
        longitude: spot.longitude,
        latitudeDelta: SPOT_DELTA,
        longitudeDelta: SPOT_DELTA,
      },
      400,
    );
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
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={CALGARY_REGION}
        customMapStyle={darkMapStyle}
        style={styles.map}
        showsUserLocation={granted}
        showsMyLocationButton={false}
        onRegionChangeComplete={setRegion}
        onPress={(event) => {
          // Belt and braces with the markers' stopPropagation: ignore the
          // synthetic map press that accompanies a marker tap.
          if ((event.nativeEvent as { action?: string }).action !== "marker-press") {
            setSelectedId(null);
            setSearchActive(false);
            Keyboard.dismiss();
          }
        }}
      >
        {items.map((item) =>
          item.kind === "cluster" ? (
            <ClusterMarker
              key={`cluster-${item.id}`}
              {...item}
              onPress={() => mapRef.current?.animateToRegion(regionToExpand(item), 300)}
            />
          ) : (
            <SpotMarker
              key={item.id}
              {...item}
              selected={item.id === selectedId}
              mine={mineIds.has(item.id)}
              label={query ? spotsById.get(item.id)?.name : undefined}
              onPress={setSelectedId}
            />
          ),
        )}
      </MapView>

      <View className="absolute inset-x-4 gap-3" style={{ top: insets.top + 8 }}>
        <SearchBar
          value={filters.query}
          onChangeText={(next) => {
            setFilters((current) => ({ ...current, query: next }));
            setSearchActive(next.trim().length > 0);
          }}
          onFocus={() => setSearchActive(query.length > 0)}
          onSubmitEditing={() => setSearchActive(false)}
        />
        {searchActive && query ? (
          <SearchSuggestions suggestions={suggestions} onPick={pickSuggestion} />
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
