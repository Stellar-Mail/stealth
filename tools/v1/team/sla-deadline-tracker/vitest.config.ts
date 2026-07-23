/**
 * Vitest configuration for the sla-deadline-tracker tool.
 *
 * Allows running ONLY this tool's tests in isolation:
 *   npx vitest run --config tools/v1/team/sla-deadline-tracker/vitest.config.ts
 *
 * Or from repo root (default config picks up all *.test.ts files including these).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "sla-deadline-tracker",
    include: ["tools/v1/team/sla-deadline-tracker/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
