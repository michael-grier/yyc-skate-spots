import type { Region } from "react-native-maps";

import type { LatLng } from "@/lib/geo";

// Deeper than this and Google's tiles stop adding detail; also stops a
// cluster of co-located spots from zooming into the void.
export const MAX_ZOOM = 18;

/** Web-Mercator zoom level for a region's longitude span (fractional). */
export function zoomForRegion(region: Region) {
  return Math.log2(360 / region.longitudeDelta);
}

/** [west, south, east, north], the order supercluster expects. */
export function regionToBbox(region: Region): [number, number, number, number] {
  const halfLng = region.longitudeDelta / 2;
  const halfLat = region.latitudeDelta / 2;
  return [
    region.longitude - halfLng,
    region.latitude - halfLat,
    region.longitude + halfLng,
    region.latitude + halfLat,
  ];
}

/**
 * A region centred on `center` at `zoom` (clamped to MAX_ZOOM), keeping the
 * aspect ratio of `current` so animating there doesn't distort the map.
 */
export function regionAtZoom(center: LatLng, zoom: number, current: Region): Region {
  const longitudeDelta = 360 / 2 ** Math.min(zoom, MAX_ZOOM);
  const aspect = current.latitudeDelta / current.longitudeDelta;
  return { ...center, longitudeDelta, latitudeDelta: longitudeDelta * aspect };
}
