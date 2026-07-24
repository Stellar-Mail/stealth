import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Vitest configuration for the Suspicious Sender Watchlist tool.
 *
 * Scoped exclusively to tests inside this folder. Does not import or depend
 * on the main application's test setup.
 *
 * Usage (from repository root):
 *   npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
 */
export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["tools/v2/team/suspicious-sender-watchlist/tests/**/*.test.{ts,tsx}"],
    // No UI, no DOM, no network — keep tests fast and isolated.
    testTimeout: 10_000,
  },
});
