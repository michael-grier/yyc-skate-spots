import { useMemo } from "react";
import type { Region } from "react-native-maps";
import Supercluster from "supercluster";

import { regionAtZoom } from "@/lib/map-math";

type Point = { id: string; latitude: number; longitude: number };

type SpotProperties = { spotId: string };

export type ClusterItem =
  | { kind: "spot"; id: string; latitude: number; longitude: number }
  | { kind: "cluster"; id: number; latitude: number; longitude: number; count: number };

// Clusters every spot rather than just the viewport: the list is capped at
// city scale, and keeping off-screen markers mounted is what lets a pan
// reveal them instantly instead of after the camera settles.
const WORLD_BBOX: [number, number, number, number] = [-180, -85, 180, 85];

/**
 * Groups nearby spots into count bubbles at an integer `zoom` (supercluster
 * has no fractional levels). Returns the items to draw plus a helper that
 * produces the region to animate to when a cluster is tapped (the zoom at
 * which it splits apart).
 */
export function useClusters(points: Point[], zoom: number) {
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

  const items = useMemo<ClusterItem[]>(
    () =>
      index.getClusters(WORLD_BBOX, zoom).map((feature) => {
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
      }),
    [index, zoom],
  );

  function regionToExpand(
    cluster: Extract<ClusterItem, { kind: "cluster" }>,
    current: Region,
  ): Region {
    return regionAtZoom(cluster, index.getClusterExpansionZoom(cluster.id), current);
  }

  return { items, regionToExpand };
}
