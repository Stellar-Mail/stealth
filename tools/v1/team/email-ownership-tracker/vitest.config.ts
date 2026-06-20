import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "email-ownership-tracker",
    include: ["tools/v1/team/email-ownership-tracker/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
