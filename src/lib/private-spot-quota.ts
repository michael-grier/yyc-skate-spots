import { privateSpotAllowance } from "@convex/privateSpots";

export type PrivateSpotQuota = { used: number; allowed: number };

type OwnedSpot = { _id: string; status: "active" | "pending" | "private" | "removed" };

/**
 * The form's copy of the server's allowance check in convex/spots.ts. The spot
 * being edited counts on neither side, matching the server, so a private spot
 * can stay private even after the allowance has shrunk beneath it.
 */
export function privateSpotQuota(spots: OwnedSpot[], excludeId?: string): PrivateSpotQuota {
  const others = spots.filter((spot) => spot._id !== excludeId);
  return {
    used: others.filter((spot) => spot.status === "private").length,
    allowed: privateSpotAllowance(others.filter((spot) => spot.status === "active").length),
  };
}
