import type { LatLng } from "@/lib/geo";
import { distanceKm } from "@/lib/geo";
import type { BustFactor, SpotType } from "@/lib/spot-labels";

export type SpotFilters = {
  /** Case-insensitive match against the spot name. */
  query: string;
  /** null = any distance. Ignored when the user's location is unknown. */
  maxDistanceKm: number | null;
  /** Empty = any type; otherwise the spot must have at least one of these. */
  types: SpotType[];
  /** Empty = any bust factor; otherwise the spot's must be one of these. */
  bustFactors: BustFactor[];
};

export const DEFAULT_FILTERS: SpotFilters = {
  query: "",
  maxDistanceKm: null,
  types: [],
  bustFactors: [],
};

/** Preset radii offered by the distance filter, in kilometres. */
export const DISTANCE_PRESETS_KM = [1, 5, 10, 25] as const;

type FilterableSpot = LatLng & {
  name: string;
  types: SpotType[];
  bustFactor: BustFactor;
};

export function applyFilters<T extends FilterableSpot>(
  spots: T[],
  filters: SpotFilters,
  userLocation: LatLng | null,
): T[] {
  const query = filters.query.trim().toLowerCase();
  return spots.filter((spot) => {
    if (query && !spot.name.toLowerCase().includes(query)) {
      return false;
    }
    if (
      filters.maxDistanceKm !== null &&
      userLocation &&
      distanceKm(userLocation, spot) > filters.maxDistanceKm
    ) {
      return false;
    }
    if (filters.types.length > 0 && !spot.types.some((type) => filters.types.includes(type))) {
      return false;
    }
    if (filters.bustFactors.length > 0 && !filters.bustFactors.includes(spot.bustFactor)) {
      return false;
    }
    return true;
  });
}

/** How many of the three chip filters are narrowing results (search excluded). */
export function countActiveFilters(filters: SpotFilters) {
  return [
    filters.maxDistanceKm !== null,
    filters.types.length > 0,
    filters.bustFactors.length > 0,
  ].filter(Boolean).length;
}
