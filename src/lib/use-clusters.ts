import { useMemo } from "react";
import type { Region } from "react-native-maps";
import Supercluster from "supercluster";

type Point = { id: string; latitude: number; longitude: number };

type SpotProperties = { spotId: string };

export type ClusterItem =
  | { kind: "spot"; id: string; latitude: number; longitude: number }
  | { kind: "cluster"; id: number; latitude: number; longitude: number; count: number };

// Web-Mercator zoom for a region's longitude span; supercluster works in
// integer zoom levels, so the fractional value is floored at the call site.
function zoomForRegion(region: Region) {
  return Math.log2(360 / region.longitudeDelta);
}

/**
 * Groups nearby spots into count bubbles for the visible region. Returns the
 * items to draw plus a helper that produces the region to animate to when a
 * cluster is tapped (the zoom at which it splits apart).
 */
export function useClusters(points: Point[], region: Region) {
  const index = useMemo(() => {
    const sc = new Supercluster<SpotProperties>({ radius: 48, maxZoom: 17 });
    sc.load(
      points.map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: { spotId: point.id },
      })),
    );
    return sc;
  }, [points]);

  const items = useMemo<ClusterItem[]>(() => {
    const halfLng = region.longitudeDelta / 2;
    const halfLat = region.latitudeDelta / 2;
    const bbox: [number, number, number, number] = [
      region.longitude - halfLng,
      region.latitude - halfLat,
      region.longitude + halfLng,
      region.latitude + halfLat,
    ];
    return index.getClusters(bbox, Math.floor(zoomForRegion(region))).map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      if ("cluster" in feature.properties && feature.properties.cluster) {
        return {
          kind: "cluster",
          id: feature.properties.cluster_id,
          latitude,
          longitude,
          count: feature.properties.point_count,
        };
      }
      return { kind: "spot", id: feature.properties.spotId, latitude, longitude };
    });
  }, [index, region]);

  function regionToExpand(cluster: Extract<ClusterItem, { kind: "cluster" }>): Region {
    const zoom = Math.min(index.getClusterExpansionZoom(cluster.id), 18);
    const longitudeDelta = 360 / 2 ** zoom;
    // Keep the map's current aspect ratio so the zoom doesn't distort.
    const aspect = region.latitudeDelta / region.longitudeDelta;
    return {
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      longitudeDelta,
      latitudeDelta: longitudeDelta * aspect,
    };
  }

  return { items, regionToExpand };
}
