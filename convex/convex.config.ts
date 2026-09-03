import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    TEST_FIXTURES_ENABLED: v.optional(v.string()),
    SEED_OWNER_TOKEN_IDENTIFIER: v.optional(v.string()),
  },
});

export default app;
