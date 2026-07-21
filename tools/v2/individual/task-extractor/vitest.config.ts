import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
