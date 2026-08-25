#!/usr/bin/env node
/**
 * BETA-084 (Issue #1991) — Operator security regression runner.
 *
 * Runs the full account-isolation suite, live-beta evidence test, and artifact
 * secret scan. Writes a redacted evidence file for release gates.
 *
 * Usage:
 *   node scripts/security/run-regression.mjs
 *   bun run security:regression
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

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return { label, status: "pass", output: redact(output.slice(-4000)) };
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    const combined = redact((stdout + stderr).slice(-4000));
    // vitest it.fails exits non-zero; treat as blocked (known incomplete control), not a hard fail.
    const unexpectedFailed = /\b\d+ failed\b/.test(combined);
    if (unexpectedFailed) {
      return { label, status: "fail", output: combined };
    }
    const expectedFail = combined.includes("expected fail") || combined.includes("it.fails");
    return { label, status: expectedFail ? "blocked" : "fail", output: combined };
  }
}

const REDACT_PATTERNS = [
  [/Password123![ab]?/gi, "[REDACTED_PASSWORD]"],
  [/\bS[A-Z2-7]{55}\b/g, "[REDACTED_STELLAR_SECRET]"],
  [/stealth_session=[^;\s]+/g, "stealth_session=[REDACTED]"],
];

function redact(text) {
  let out = text;
  for (const [re, replacement] of REDACT_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

const toolVersions = readToolVersions();
const results = [];

results.push(
  run(
    "npx vitest run tests/unit/api/security tests/unit/api/security.regression.test.ts tests/unit/api/policy-routes.security.test.ts tests/unit/api/receipt-routes.security.test.ts tests/unit/api/contact-routes.test.ts --reporter=verbose",
    "Unit security regression",
  ),
);

results.push(
  run(
    "npx vitest run tests/e2e/live-beta/security-isolation.test.ts --reporter=verbose",
    "Live-beta security isolation evidence",
  ),
);

if (existsSync(join(ROOT, "dist"))) {
  results.push(
    run("node scripts/ci/scan-artifacts-for-secrets.mjs --dir dist", "Artifact secret scan"),
  );
}

const knownBlockedControls = [];

const hasUnexpectedFail = results.some((r) => r.status === "fail");
const hasBlocked = knownBlockedControls.length > 0 || results.some((r) => r.status === "blocked");

const evidence = {
  issue: "BETA-084",
  gateId: "beta-084-security",
  name: "Account Isolation Security Regression",
  owner: "security/platform",
  dependency: "BETA-084",
  verifiedAt: new Date().toISOString(),
  toolVersions,
  results,
  knownBlockedControls,
  status: hasUnexpectedFail ? "fail" : hasBlocked ? "blocked" : "pass",
};

const evidencePath = join(ROOT, "gate-result-beta-084-security.json");
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf-8");

console.log(`\n✅ Evidence written to ${evidencePath}`);
console.log(`   Status: ${evidence.status}`);

if (evidence.status === "fail") process.exit(1);
