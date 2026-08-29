#!/usr/bin/env node
/**
 * BETA-098 (Issue #2005) — Operator acceptance session runner.
 *
 * Usage:
 *   node scripts/beta-acceptance/run-session.mjs
 *   bun run beta-acceptance:session
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
    return { label, status: "fail", output: combined };
  }
}

const results = [];
results.push(run("npm run test:beta:acceptance", "Acceptance evidence (vitest)"));
results.push(
  run(
    "npx playwright test tests/e2e/beta-acceptance/acceptance-journeys.spec.ts --reporter=line",
    "Acceptance journeys (Playwright)",
  ),
);

const hasFail = results.some((r) => r.status === "fail");
const evidence = {
  issue: "BETA-098",
  gateId: "beta-098-acceptance",
  name: "Usability & Accessibility Acceptance Session",
  owner: "product/ux",
  dependency: "BETA-098",
  verifiedAt: new Date().toISOString(),
  toolVersions: readToolVersions(),
  results,
  status: hasFail ? "fail" : "pass",
};

const evidencePath = join(ROOT, "gate-result-beta-098-acceptance.json");
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf-8");
console.log(`\n✅ Evidence written to ${evidencePath}`);
console.log(`   Status: ${evidence.status}`);
if (hasFail) process.exit(1);
