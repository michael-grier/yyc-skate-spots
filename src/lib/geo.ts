export type LatLng = { latitude: number; longitude: number };

/** Downtown Calgary; the fallback centre when the user's location is unknown. */
export const CALGARY_CENTER: LatLng = { latitude: 51.0447, longitude: -114.0719 };

const EARTH_RADIUS_KM = 6371;
const DECIMAL_COORDINATE = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*°?\s*([NSEW])?$/i;

function parseCoordinate(value: string, axis: "latitude" | "longitude") {
  const match = DECIMAL_COORDINATE.exec(value.trim().replaceAll("−", "-"));
  if (!match) {
    return null;
  }

  const numberText = match[1];
  const direction = match[2]?.toUpperCase();
  let coordinate = Number(numberText);
  if (!Number.isFinite(coordinate)) {
    return null;
  }

  if (direction) {
    const validDirections = axis === "latitude" ? ["N", "S"] : ["E", "W"];
    if (!validDirections.includes(direction)) {
      return null;
    }

    const directionSign = direction === "S" || direction === "W" ? -1 : 1;
    const explicitSign = numberText.startsWith("-") ? -1 : numberText.startsWith("+") ? 1 : null;
    if (explicitSign !== null && explicitSign !== directionSign) {
      return null;
    }
    coordinate = Math.abs(coordinate) * directionSign;
  }

  return coordinate;
}

/** Parses one latitude-first decimal pair copied from Google or Apple Maps. */
export function parseCoordinatePair(value: string): LatLng | null {
  let pair = value.trim();
  const hasMatchingBrackets =
    (pair.startsWith("(") && pair.endsWith(")")) ||
    (pair.startsWith("[") && pair.endsWith("]"));
  if (hasMatchingBrackets) {
    pair = pair.slice(1, -1);
  }

  const parts = pair.split(",");
  if (parts.length !== 2) {
    return null;
  }

  const latitude = parseCoordinate(parts[0], "latitude");
  const longitude = parseCoordinate(parts[1], "longitude");
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

/** Stable, sub-metre decimal display for a map coordinate pair. */
export function formatCoordinatePair({ latitude, longitude }: LatLng) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/** Great-circle distance between two coordinates, in kilometres. */
export function distanceKm(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "850 m" under a kilometre, otherwise "1.2 km". */
export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
