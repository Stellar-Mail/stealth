import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "inbox-daily-digest",
    include: ["tools/v1/individual/inbox-daily-digest/tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
