/**
 * Component/hook tests (React Native, jest-expo). Ownership split with
 * vitest: jest runs *.test.tsx, vitest runs *.test.ts (pure logic + Convex).
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Steers react-native-worklets away from its .native entry points, which expect a
  // JSI runtime that does not exist under Jest. Reanimated pulls it in transitively.
  resolver: "react-native-worklets/jest/resolver.js",
  setupFiles: [
    "<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js",
    "<rootDir>/jest.setup.js",
  ],
  testMatch: ["<rootDir>/src/**/*.test.tsx"],
  moduleNameMapper: {
    // Specific before generic, mirroring tsconfig paths: @/assets lives at
    // the repo root, everything else under @/ is src/.
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@convex/(.*)$": "<rootDir>/convex/$1",
  },
};
