/** A width/height pair in points. */
export type Size = { width: number; height: number };

/**
 * The box `contentFit="contain"` actually paints a photo into. Falls back to the whole
 * viewport until the photo reports its dimensions, so pan bounds always stay finite.
 */
export function containedSize(source: Size | undefined, viewport: Size): Size {
  if (!source || source.width <= 0 || source.height <= 0) return viewport;
  const fit = Math.min(viewport.width / source.width, viewport.height / source.height);
  return { width: source.width * fit, height: source.height * fit };
}
