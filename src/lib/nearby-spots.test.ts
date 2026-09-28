import { expect, test } from "vitest";

import { findNearbySpots } from "@/lib/nearby-spots";

const point = { latitude: 51.0447, longitude: -114.0719 };
// About 11 m per 0.0001 degrees of latitude.
const spot = (_id: string, latitudeOffset: number) => ({
  _id,
  name: `Spot ${_id}`,
  latitude: point.latitude + latitudeOffset,
  longitude: point.longitude,
});

test("lists spots within 50 m, nearest first, once each and without the edited spot", () => {
  const candidates = [
    spot("far", 0.001),
    spot("near", 0.0003),
    spot("nearest", 0.0001),
    spot("editing", 0),
    spot("near", 0.0003),
  ];
  expect(findNearbySpots(point, candidates, "editing").map((match) => match._id)).toEqual([
    "nearest",
    "near",
  ]);
});
