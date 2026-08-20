import { defineConfig } from "vitest/config";

// convex-test requires the edge-runtime environment to mirror the Convex
// function runtime; pure-logic modules under src/lib run in it just as well.
// React Native components and hooks are not covered by this runner.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
