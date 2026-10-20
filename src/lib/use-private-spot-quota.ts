import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";

import { privateSpotQuota } from "@/lib/private-spot-quota";

/** Undefined while the caller's spots are loading, which the field shows as no hint. */
export function usePrivateSpotQuota(excludeId?: string) {
  const mine = useQuery(api.spots.mine);
  return useMemo(() => (mine ? privateSpotQuota(mine, excludeId) : undefined), [mine, excludeId]);
}
