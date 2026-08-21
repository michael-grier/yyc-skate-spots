/** HTTP actions are served from the .site domain of a Convex deployment. */
export function convexSiteUrl(cloudUrl: string) {
  return cloudUrl.replace(/\.convex\.cloud$/, ".convex.site");
}
