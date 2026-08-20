import { defineConfig } from "vitest/config";

// convex-test requires the edge-runtime environment to mirror the Convex
// function runtime. App (React Native) code is not covered by this runner.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
