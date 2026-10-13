import type { EdgePadding, Region } from "react-native-maps";

import type { LatLng, LatLngBounds } from "@/lib/geo";

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
 * `region` shifted as little as possible to keep its view inside `bounds`. On
 * an axis where the view is wider than the bounds, it centres on the bounds.
 */
export function clampRegion(region: Region, bounds: LatLngBounds): Region {
  return {
    ...region,
    latitude: clampAxis(region.latitude, region.latitudeDelta / 2, bounds.south, bounds.north),
    longitude: clampAxis(region.longitude, region.longitudeDelta / 2, bounds.west, bounds.east),
  };
}

function clampAxis(centre: number, half: number, min: number, max: number) {
  if (max - min <= 2 * half) {
    return (min + max) / 2;
  }
  return Math.min(Math.max(centre, min + half), max - half);
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

// Gap kept between framed pins and anything drawn over the map; fits a pin and its label.
const PIN_MARGIN = 48;
// Least map height left for framing. A long suggestion list gives way to it,
// since pins behind the list are no worse than pins behind the keyboard.
const MIN_FIT_SPAN = 120;

/**
 * Widens `padding` so framed pins land between the search chrome and the
 * keyboard. Positions are measured down from the map's top edge.
 */
export function paddingAboveKeyboard(
  padding: EdgePadding,
  {
    mapHeight,
    chromeBottom,
    keyboardTop,
  }: { mapHeight: number; chromeBottom: number; keyboardTop: number },
): EdgePadding {
  const bottom = Math.max(padding.bottom, mapHeight - keyboardTop + PIN_MARGIN);
  const top = Math.min(
    Math.max(padding.top, chromeBottom + PIN_MARGIN),
    mapHeight - bottom - MIN_FIT_SPAN,
  );
  return { ...padding, top, bottom };
}

/**
 * Points to fit so the map centres on `center`, spans at least `minSpan`
 * degrees, and still shows `include`. Mirroring `include` through the centre
 * keeps the fit from drifting toward it.
 */
export function framingAround(center: LatLng, minSpan: number, include: LatLng | null): LatLng[] {
  const half = minSpan / 2;
  const points = [
    { latitude: center.latitude - half, longitude: center.longitude - half },
    { latitude: center.latitude + half, longitude: center.longitude + half },
  ];
  if (include) {
    points.push(include, {
      latitude: 2 * center.latitude - include.latitude,
      longitude: 2 * center.longitude - include.longitude,
    });
  }
  return points;
}
