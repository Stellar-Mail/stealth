import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "email-summarizer",
    include: ["tools/v1/individual/email-summarizer/tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
