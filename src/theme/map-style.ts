import type { MapStyleElement } from "react-native-maps";

import { mapColors } from "@/theme/colors";

/**
 * Matte-graphite Google Maps style: dark land, faint roads, muted labels,
 * POI markers off so user-added spot pins are the only points on the map.
 */
export const darkMapStyle: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: mapColors.land }] },
  { elementType: "labels.text.fill", stylers: [{ color: mapColors.label }] },
  { elementType: "labels.text.stroke", stylers: [{ color: mapColors.land }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: mapColors.park }, { visibility: "on" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: mapColors.roadMinor }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: mapColors.road }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: mapColors.road }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: mapColors.water }] },
];
