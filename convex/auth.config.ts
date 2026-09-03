// Clerk JWT verification. CLERK_JWT_ISSUER_DOMAIN is the Frontend API URL
// from Clerk's Convex integration; without this file
// ctx.auth.getUserIdentity() always returns null.

// This file is evaluated at deploy time under Node, but the Convex function
// tsconfig has no Node types — declare the one global this file reads.
declare const process: { env: Record<string, string | undefined> };

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
