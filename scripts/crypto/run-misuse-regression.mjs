#!/usr/bin/env node
/**
 * BETA-085 (Issue #1992) — Operator crypto misuse regression runner.
 *
 * Usage:
 *   node scripts/crypto/run-misuse-regression.mjs
 *   bun run crypto:misuse-regression
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readToolVersions() {
  const path = join(ROOT, "scripts", "ci", "tool-versions.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
}

const REDACT_PATTERNS = [
  [/Password123![ab]?/gi, "[REDACTED_PASSWORD]"],
  [/\bS[A-Z2-7]{55}\b/g, "[REDACTED_STELLAR_SECRET]"],
  [/stealth_session=[^;\s]+/g, "stealth_session=[REDACTED]"],
];

function redact(text) {
  let out = text;
  for (const [re, replacement] of REDACT_PATTERNS) out = out.replace(re, replacement);
  return out;
}

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return { label, status: "pass", output: redact(output.slice(-4000)) };
  } catch (error) {
    const combined = redact(
      ((error.stdout?.toString() ?? "") + (error.stderr?.toString() ?? "")).slice(-4000),
    );
    return { label, status: /\b\d+ failed\b/.test(combined) ? "fail" : "fail", output: combined };
  }
}

const results = [];

results.push(
  run(
    "npx vitest run tests/unit/crypto/misuse-resistance.test.ts tests/unit/crypto/fuzz.test.ts tests/unit/crypto/api-surface.test.ts tests/unit/stellar/managed-wallet.test.ts --reporter=verbose",
    "BETA-085 unit misuse suites",
  ),
);

results.push(
  run(
    "npx vitest run tests/e2e/live-beta/crypto-misuse-evidence.test.ts --reporter=verbose",
    "Live-beta crypto misuse evidence",
  ),
);

const hasFail = results.some((r) => r.status === "fail");
const evidence = {
  issue: "BETA-085",
  gateId: "beta-085-crypto",
  name: "Cryptography & Managed-Wallet Misuse Regression",
  owner: "security/platform",
  dependency: "BETA-085",
  verifiedAt: new Date().toISOString(),
  toolVersions: readToolVersions(),
  results,
  status: hasFail ? "fail" : "pass",
};

const evidencePath = join(ROOT, "gate-result-beta-085-crypto.json");
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf-8");
console.log(`\n✅ Evidence written to ${evidencePath}`);
console.log(`   Status: ${evidence.status}`);
if (hasFail) process.exit(1);
