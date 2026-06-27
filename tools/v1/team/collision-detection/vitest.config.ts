import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "collision-detection",
    include: ["tools/v1/team/collision-detection/tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
