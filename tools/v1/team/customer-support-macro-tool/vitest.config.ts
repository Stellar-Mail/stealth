/**
 * Vitest configuration for the customer-support-macro-tool.
 *
 * Allows running ONLY this tool's tests in isolation:
 *   npx vitest run --config tools/v1/team/customer-support-macro-tool/vitest.config.ts
 *
 * Or from repo root (default config picks up all *.test.ts files including these).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "customer-support-macro-tool",
    include: ["tools/v1/team/customer-support-macro-tool/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
