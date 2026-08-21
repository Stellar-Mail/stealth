import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    testTimeout: 60_000,
    // Primary CI target: unit tests.
    // Integration, contract, and live-beta suites can be run with:
    //   npx vitest run tests/integration
    //   npx vitest run tests/contracts
    //   npx vitest run tests/e2e/live-beta
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
      "tests/contracts/**/*.test.ts",
      "tests/e2e/live-beta/**/*.test.ts",
    ],
  },
});
