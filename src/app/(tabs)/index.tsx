import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClusterMarker } from "@/components/cluster-marker";
import { type FilterSection, FilterChips } from "@/components/filter-chips";
import { FilterSheet } from "@/components/filter-sheet";
import { LocateIcon } from "@/components/icons";
import { SearchBar } from "@/components/search-bar";
import { SpotMarker } from "@/components/spot-marker";
import { SpotPreviewCard } from "@/components/spot-preview-card";
import { distanceKm } from "@/lib/geo";
import { DEFAULT_FILTERS, applyFilters } from "@/lib/spot-filters";
import { useClusters } from "@/lib/use-clusters";
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
  // undefined while the first result is in flight; the map renders empty.
  const allSpots = useQuery(api.spots.list) ?? NO_SPOTS;
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const selectedSpot = spots.find((spot) => spot._id === selectedId);

  function openFilters(section: FilterSection) {
    // A radius is meaningless without a position, so ask as the sheet opens.
    if (section === "distance" && !coords) {
      void locate();
    }
    sheetRef.current?.present();
  }

  async function handleLocate() {
    const position = await locate();
    if (position) {
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
              onPress={setSelectedId}
            />
          ),
        )}
      </MapView>

      <View className="absolute inset-x-4 gap-3" style={{ top: insets.top + 8 }}>
        <SearchBar
          value={filters.query}
          onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
        />
        <FilterChips filters={filters} onOpen={openFilters} />
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
