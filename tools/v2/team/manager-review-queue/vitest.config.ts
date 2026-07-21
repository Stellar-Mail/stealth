import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] }), react()],
  test: {
    globals: true,
    environment: "node",
    include: ["tools/v2/team/manager-review-queue/tests/**/*.test.{ts,tsx}"],
  },
});
