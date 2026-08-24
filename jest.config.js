/**
 * Component/hook tests (React Native, jest-expo). Ownership split with
 * vitest: jest runs *.test.tsx, vitest runs *.test.ts (pure logic + Convex).
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@convex/(.*)$": "<rootDir>/convex/$1",
  },
};
