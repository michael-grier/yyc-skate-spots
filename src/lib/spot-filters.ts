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

/** True when search or any chip filter is narrowing the map. */
export function hasActiveFilters(filters: SpotFilters) {
  return filters.query.trim().length > 0 || countActiveFilters(filters) > 0;
}

/**
 * The spots to list under the search bar: nearest first when the user's
 * location is known, otherwise alphabetical, capped at `limit`.
 */
export function rankSuggestions<T extends FilterableSpot>(
  spots: T[],
  userLocation: LatLng | null,
  limit = 6,
): T[] {
  const sorted = [...spots].sort((a, b) =>
    userLocation
      ? distanceKm(userLocation, a) - distanceKm(userLocation, b)
      : a.name.localeCompare(b.name),
  );
  return sorted.slice(0, limit);
}

/**
 * Identity of a "frame the results" request, or null when there is nothing to
 * frame (no active filters, or no matches yet). Two equal keys mean the
 * viewport is already framed for this state, so the map doesn't re-fit on
 * unrelated re-renders — but it does once location becomes known or results
 * reappear after being empty.
 */
export function fitKeyFor(
  filters: SpotFilters,
  userLocation: LatLng | null,
  resultCount: number,
): string | null {
  if (resultCount === 0 || !hasActiveFilters(filters)) {
    return null;
  }
  return JSON.stringify({ filters, userLocation });
}
