#!/usr/bin/env node
/**
 * BETA-088 — write a standardized gate result JSON artifact.
 *
 * Usage:
 *   node scripts/ci/write-gate-result.mjs \
 *     --gate-id beta-migrations \
 *     --name "Migration Gates" \
 *     --owner platform/storage \
 *     --dependency BETA-082 \
 *     --status pass \
 *     [--message "..."] \
 *     [--evidence-json '{"command":"npm run migrations:integrity-check"}']
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);

function readArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const gateId = readArg("--gate-id");
const name = readArg("--name");
const owner = readArg("--owner");
const dependency = readArg("--dependency");
const status = readArg("--status");
const message = readArg("--message");
const evidenceRaw = readArg("--evidence-json");

if (!gateId || !name || !owner || !status) {
  console.error(
    "Usage: write-gate-result.mjs --gate-id <id> --name <name> --owner <owner> --status pass|fail|blocked|skipped [--dependency BETA-xxx] [--message ...] [--evidence-json '{}']",
  );
  process.exit(1);
}

const allowed = new Set(["pass", "fail", "blocked", "skipped"]);
if (!allowed.has(status)) {
  console.error(`Invalid status: ${status}`);
  process.exit(1);
}

let evidence;
if (evidenceRaw) {
  try {
    evidence = JSON.parse(evidenceRaw);
  } catch {
    console.error("Invalid --evidence-json");
    process.exit(1);
  }
}

const result = {
  gateId,
  name,
  owner,
  dependency: dependency ?? null,
  status,
  message: message ?? null,
  evidence: evidence ?? null,
  verifiedAt: new Date().toISOString(),
};

const outPath = join(ROOT, `gate-result-${gateId}.json`);
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
console.log(`Wrote ${outPath}`);
