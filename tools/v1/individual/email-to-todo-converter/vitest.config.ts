import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/v1/individual/email-to-todo-converter/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    environment: "node",
    globals: true,
  },
});
