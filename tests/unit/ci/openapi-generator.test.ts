import { readFileSync } from "node:fs";
import { join } from "node:path";
import prettier from "prettier";
import { describe, expect, it } from "vitest";

describe("OpenAPI generator output", () => {
  it("formats generated JSON with the repo Prettier config", () => {
    const src = readFileSync(join(process.cwd(), "scripts/generate-openapi.ts"), "utf-8");
    expect(src).toContain('prettier.format(raw, { ...config, parser: "json" })');
  });

  it("commits openapi.json that matches prettier.format", async () => {
    const path = join(process.cwd(), "openapi.json");
    const json = readFileSync(path, "utf-8");
    const config = await prettier.resolveConfig(path);
    const formatted = await prettier.format(json, { ...config, parser: "json" });
    expect(json).toBe(formatted);
    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json).openapi).toBe("3.1.0");
  });
});
