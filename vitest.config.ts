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
    testTimeout: 60_000,
    env: {
      // Explicit non-production escape hatch so existing unit suites that send
      // only x-stealth-address keep working. Security regression tests set
      // STEALTH_AUTH_REQUIRE_SIGNED=1 to exercise STEALTH-AUTH-V1.
      STEALTH_AUTH_ALLOW_HEADER_ONLY: "1",
    },
  },
});
