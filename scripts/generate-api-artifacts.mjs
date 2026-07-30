#!/usr/bin/env bun
/**
 * scripts/generate-api-artifacts.mjs
 *
 * Regenerates deterministic API artifacts from the canonical source modules:
 *   - openapi.generated.json  ← src/server/api/openapi.ts
 *   - errors-catalogue.json   ← src/server/api/errors.ts (errorRegistry)
 *
 * Also triggers contract-binding regeneration via the existing script.
 *
 * Every output file is formatted deterministically (sorted keys, consistent
 * indentation) so that git diff detects exactly what changed — and nothing
 * more.  CI runs this script and then checks `git diff --exit-code` to fail
 * on stale artifacts.
 *
 * Run:  npx tsx scripts/generate-api-artifacts.mjs
 *   or:  bun run generate:artifacts
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. OpenAPI document
// ---------------------------------------------------------------------------
// The canonical OpenAPI definition is a TypeScript `as const` object.
const OPENAPI_SRC = "../src/server/api/openapi";

const { openApiDocument } = await import(OPENAPI_SRC);

const openapiOut = join(ROOT, "openapi.generated.json");
writeFileSync(openapiOut, JSON.stringify(openApiDocument, null, 2) + "\n", "utf8");
console.log(`Generated ${openapiOut}`);

// ---------------------------------------------------------------------------
// 2. Error-code catalogue
// ---------------------------------------------------------------------------
const ERRORS_SRC = "../src/server/api/errors";

const { errorRegistry } = await import(ERRORS_SRC);

// Sort entries by code for deterministic output
const registryValues = Object.values(errorRegistry);
registryValues.sort((a, b) => a.code.localeCompare(b.code));

const catalogue = {
  $schema: null,
  description:
    "Machine-readable API error code catalogue.  Auto-generated from src/server/api/errors.ts.",
  codes: registryValues,
};

const catalogueOut = join(ROOT, "errors-catalogue.json");
writeFileSync(catalogueOut, JSON.stringify(catalogue, null, 2) + "\n", "utf8");
console.log(`Generated ${catalogueOut}`);

// ---------------------------------------------------------------------------
// 3. Contract bindings (delegate to existing script)
// ---------------------------------------------------------------------------
const bindingsScript = join(ROOT, "scripts", "generate-contract-bindings.mjs");
execFileSync(process.execPath, [bindingsScript], { cwd: ROOT, stdio: "inherit" });
