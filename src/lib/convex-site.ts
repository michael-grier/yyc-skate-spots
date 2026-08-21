/**
 * Where the app's HTTP actions live. Convex serves them from a separate
 * host: `<deployment>.convex.site` for default deployments, or whatever the
 * project configured for a custom domain — which cannot be derived from the
 * cloud URL, hence the explicit setting taking precedence.
 */
export function resolveConvexSiteUrl(cloudUrl: string, siteUrl: string | undefined) {
  if (siteUrl) {
    return siteUrl.replace(/\/$/, "");
  }
  return cloudUrl.replace(/\.convex\.cloud$/, ".convex.site");
}

/** True when the site URL cannot be inferred and must be configured. */
export function needsExplicitSiteUrl(cloudUrl: string) {
  return !/\.convex\.cloud$/.test(cloudUrl);
}
