import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    // Server-only credentials used by the authenticated account-deletion action.
    // They remain optional at deploy time so local/preview deployments can boot;
    // deletion fails closed with a configuration error until they are present.
    CLERK_SECRET_KEY: v.optional(v.string()),
    APPLE_TEAM_ID: v.optional(v.string()),
    APPLE_SIGN_IN_KEY_ID: v.optional(v.string()),
    APPLE_SIGN_IN_PRIVATE_KEY: v.optional(v.string()),
    TEST_FIXTURES_ENABLED: v.optional(v.string()),
    SEED_OWNER_TOKEN_IDENTIFIER: v.optional(v.string()),
  },
});

export default app;
