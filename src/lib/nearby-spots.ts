import { type LatLng, distanceKm } from "@/lib/geo";

/**
 * Pins for the same feature rarely land on the same point, but a plaza can hold several real
 * spots, so this only prompts a check. It never blocks a submission.
 */
export const DUPLICATE_RADIUS_M = 50;
const MAX_NEARBY = 3;

type Candidate = LatLng & { _id: string; name: string };
export type NearbySpot = { _id: string; name: string; distanceM: number };

/** Spots within the duplicate radius of a point, nearest first. Repeated ids count once. */
export function findNearbySpots(point: LatLng, candidates: Candidate[], excludeId?: string) {
  const nearby = new Map<string, NearbySpot>();
  for (const spot of candidates) {
    if (spot._id === excludeId || nearby.has(spot._id)) continue;
    const distanceM = distanceKm(point, spot) * 1000;
    if (distanceM <= DUPLICATE_RADIUS_M) {
      nearby.set(spot._id, { _id: spot._id, name: spot.name, distanceM });
    }
  }
  return [...nearby.values()].sort((a, b) => a.distanceM - b.distanceM).slice(0, MAX_NEARBY);
}
