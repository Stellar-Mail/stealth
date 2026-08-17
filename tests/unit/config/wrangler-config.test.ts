import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  findPlaceholders,
  isPlaceholderToken,
  isRealResourceId,
  parseJsonc,
  resolvePlaceholders,
  stripJsoncComments,
  validateCommittedConfig,
  validateResolvedConfig,
} from "../../../src/server/migrations/wrangler-config-guard";

const WRANGLER_JSONC = fileURLToPath(new URL("../../../wrangler.jsonc", import.meta.url));

describe("wrangler config guard (BETA-024)", () => {
  it("recognizes placeholder tokens and real resource IDs", () => {
    expect(isPlaceholderToken("{STEALTH_KV_PREVIEW_ID}")).toBe(true);
    expect(isPlaceholderToken("stealth-kv-beta-prod-id")).toBe(false);
    expect(isPlaceholderToken("abc")).toBe(false);
    expect(isRealResourceId("0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f")).toBe(true);
    expect(isRealResourceId("{STEALTH_KV_LOCAL_ID}")).toBe(false);
  });

  it("strips JSONC comments and parses the committed config", () => {
    const config = parseJsonc<Record<string, any>>(readFileSync(WRANGLER_JSONC, "utf8"));
    expect(config.main).toBe("src/server.ts");
    expect(config.env?.preview).toBeDefined();
    expect(config.env?.production).toBeDefined();
  });

  it("committed wrangler.jsonc never contains real resource IDs and isolates environments", () => {
    const source = readFileSync(WRANGLER_JSONC, "utf8");
    const result = validateCommittedConfig(source);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);

    const config = parseJsonc<Record<string, any>>(source);
    const serialized = JSON.stringify(config);

    // No real IDs may ever be committed.
    expect(isRealResourceId(config.kv_namespaces?.[0]?.id)).toBe(false);
    expect(config.env.preview.kv_namespaces[0].id).not.toBe(
      config.env.production.kv_namespaces[0].id,
    );
    expect(serialized).not.toMatch(/[0-9a-f]{32}/);

    // Placeholder tokens are present so the generator can substitute them.
    const tokens = findPlaceholders(config).map((t) => t.token);
    expect(tokens).toContain("{STEALTH_KV_PREVIEW_ID}");
    expect(tokens).toContain("{STEALTH_KV_PRODUCTION_ID}");

    // Both named environments declare bindings and secret references.
    for (const envName of ["preview", "production"]) {
      expect(config.env[envName].durable_objects.bindings.length).toBeGreaterThan(0);
      expect(config.env[envName].secrets.required).toContain("STEALTH_CURSOR_SECRET");
    }
  });

  it("resolvePlaceholders substitutes tokens and records missing variables", () => {
    const config = parseJsonc<Record<string, any>>(readFileSync(WRANGLER_JSONC, "utf8"));
    const missing: string[] = [];
    const resolved = resolvePlaceholders(
      config,
      {
        STEALTH_KV_LOCAL_ID: "local",
        STEALTH_KV_PREVIEW_ID: "preview",
        STEALTH_KV_PRODUCTION_ID: "prod",
      },
      missing,
    ) as Record<string, any>;

    expect(missing).toEqual([]);
    expect(resolved.kv_namespaces[0].id).toBe("local");
    expect(resolved.env.preview.kv_namespaces[0].id).toBe("preview");
    expect(resolved.env.production.kv_namespaces[0].id).toBe("prod");
  });

  it("generation fails when required variables are missing", () => {
    const config = parseJsonc<Record<string, any>>(readFileSync(WRANGLER_JSONC, "utf8"));
    const missing: string[] = [];
    resolvePlaceholders(config, {}, missing);
    expect(missing).toContain("STEALTH_KV_PREVIEW_ID");
    expect(missing).toContain("STEALTH_KV_PRODUCTION_ID");
  });

  it("resolved config validation rejects leftover placeholders or shared storage", () => {
    const bad = {
      env: {
        preview: { kv_namespaces: [{ id: "{STEALTH_KV_PREVIEW_ID}" }] },
        production: { kv_namespaces: [{ id: "{STEALTH_KV_PREVIEW_ID}" }] },
      },
    };
    const result = validateResolvedConfig(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("Placeholder tokens remain");
    expect(result.errors.join("\n")).toContain("same KV namespace");

    const good = {
      env: {
        preview: { kv_namespaces: [{ id: "preview-ns" }] },
        production: { kv_namespaces: [{ id: "prod-ns" }] },
      },
    };
    expect(validateResolvedConfig(good).ok).toBe(true);
  });
});
