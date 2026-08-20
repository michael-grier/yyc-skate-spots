import { useMemo } from "react";
import type { Region } from "react-native-maps";
import Supercluster from "supercluster";

import { regionAtZoom, regionToBbox, zoomForRegion } from "@/lib/map-math";

type Point = { id: string; latitude: number; longitude: number };

type SpotProperties = { spotId: string };

export type ClusterItem =
  | { kind: "spot"; id: string; latitude: number; longitude: number }
  | { kind: "cluster"; id: number; latitude: number; longitude: number; count: number };

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

  const items = useMemo<ClusterItem[]>(
    () =>
      // supercluster works in integer zoom levels.
      index.getClusters(regionToBbox(region), Math.floor(zoomForRegion(region))).map((feature) => {
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
    [index, region],
  );

  function regionToExpand(cluster: Extract<ClusterItem, { kind: "cluster" }>): Region {
    return regionAtZoom(cluster, index.getClusterExpansionZoom(cluster.id), region);
  }

  return { items, regionToExpand };
}
