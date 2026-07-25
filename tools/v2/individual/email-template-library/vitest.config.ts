import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    globals: true,
    environment: "node",
    include: ["tests/templateCatalog.test.ts"],
    exclude: ["tests/service.test.ts", "tests/execution-contract.test.ts"],
  },
});
