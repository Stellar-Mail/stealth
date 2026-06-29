import { defineConfig } from "vitest/config";

// Local vitest config to run the demo-admin-dashboard tests in isolation.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/features/demo-admin-dashboard/tests/**/*.test.ts"],
    watch: false,
  },
});
