import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// convex-test requires the edge-runtime environment to mirror the Convex
// function runtime; pure-logic modules under src/lib run in it just as well.
// React Native components and hooks are not covered by this runner. Script
// tests opt into Node per file because they exercise Git and the filesystem.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "scripts/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
