/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/src/test-utils/testEnv.ts"],
  setupFilesAfterEnv: [],
  testTimeout: 30000,
  forceExit: true,
};
