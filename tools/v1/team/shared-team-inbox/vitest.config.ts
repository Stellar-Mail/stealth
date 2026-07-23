/**
 * Vitest configuration for the shared-team-inbox tool.
 *
 * Allows running ONLY this tool's tests in isolation:
 *   bun x vitest run --config tools/v1/team/shared-team-inbox/vitest.config.ts
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
