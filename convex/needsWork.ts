// Shared by the server checks and the forms, so the two cannot drift.

/**
 * A spot tagged as needing work must show what to fix, in its notes or its
 * photos; otherwise the tag tells a skater nothing they can act on.
 */
export function describesWork(notes: string | undefined, photoCount: number) {
  return (notes?.trim() ?? "") !== "" || photoCount > 0;
}
