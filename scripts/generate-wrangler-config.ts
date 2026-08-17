/**
 * BETA-024 (Issue #1931) — generate a deployable wrangler config by injecting
 * real Cloudflare resource IDs from environment variables.
 *
 * The committed `wrangler.jsonc` ships placeholder tokens (`{STEALTH_KV_...}`)
 * and never contains real IDs. This script substitutes the values provided via
 * environment variables and writes the resolved config to the gitignored
 * `.wrangler/generated/wrangler.jsonc`, which is what `wrangler deploy --env
 * preview|production` should be pointed at.
 *
 * Usage:
 *   bun run config:generate
 *   bun run config:check        # CI-safe: validate the committed config only
 *
 * Required env vars (see `.env.example`):
 *   STEALTH_KV_LOCAL_ID        # local `wrangler dev` KV namespace (any local value)
 *   STEALTH_KV_PREVIEW_ID      # preview KV namespace id
 *   STEALTH_KV_PRODUCTION_ID   # production KV namespace id (must differ from preview)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findPlaceholders,
  parseJsonc,
  resolvePlaceholders,
  validateCommittedConfig,
  validateResolvedConfig,
} from "../src/server/migrations/wrangler-config-guard";

const ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const SOURCE = join(ROOT, "wrangler.jsonc");
const OUTPUT_DIR = join(ROOT, ".wrangler", "generated");
const OUTPUT = join(OUTPUT_DIR, "wrangler.jsonc");

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const source = readFileSync(SOURCE, "utf8");

const committed = validateCommittedConfig(source);
if (!committed.ok) {
  fail(
    `Committed wrangler.jsonc violates the bindings policy:\n  ${committed.errors.join("\n  ")}`,
  );
}
console.log("✓ Committed wrangler.jsonc uses only placeholder tokens (no real IDs committed).");

if (checkOnly) {
  console.log("✓ Config check passed. No real resource IDs or secrets in committed config.");
  process.exit(0);
}

const config = parseJsonc<Record<string, unknown>>(source);
const tokens = findPlaceholders(config);
const required = [...new Set(tokens.map((t) => t.token.slice(1, -1)))].sort();
const missing = required.filter((name) => {
  const value = process.env[name];
  return value === undefined || value.trim() === "";
});
if (missing.length > 0) {
  fail(
    `Missing required environment variables for config generation:\n  ${missing.join(
      ", ",
    )}\nSee .env.example for the variables to provide.`,
  );
}

const resolved = resolvePlaceholders(
  config,
  Object.fromEntries(required.map((name) => [name, process.env[name]!.trim()])),
) as Record<string, unknown>;

const resolvedCheck = validateResolvedConfig(resolved);
if (!resolvedCheck.ok) {
  fail(`Generated config failed validation:\n  ${resolvedCheck.errors.join("\n  ")}`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(resolved, null, 2) + "\n", "utf8");

console.log(
  `✓ Generated ${OUTPUT.replace(ROOT, ".")} from ${required.length} environment variable(s): ${required
    .map((name) => name.replace(/^STEALTH_/, ""))
    .join(", ")}.`,
);
console.log(
  "  Deploy with: wrangler deploy --env preview|production --config .wrangler/generated/wrangler.jsonc",
);
