import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "grammar-cleaner",
    include: ["tools/v1/individual/grammar-cleaner/tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: false,
    reporters: ["verbose"],
  },
});
