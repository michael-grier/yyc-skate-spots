// Shared by the server check and the form's quota hint, so the two cannot drift.

/** Private spots every contributor can hold before publishing anything. */
export const FREE_PRIVATE_SPOTS = 3;
/** Extra private spots earned for each spot currently published on the map. */
export const PRIVATE_SPOTS_PER_PUBLISHED = 3;

/**
 * How many private spots a contributor may hold given their published count.
 * Spots removed by an admin or flipped back to private do not count, so the
 * allowance can shrink; existing private spots are never revoked, only new
 * ones refused.
 */
export function privateSpotAllowance(publishedCount: number) {
  return FREE_PRIVATE_SPOTS + PRIVATE_SPOTS_PER_PUBLISHED * publishedCount;
}
