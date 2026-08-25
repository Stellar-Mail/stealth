#!/usr/bin/env node
/**
 * BETA-088 — deterministic artifact drift verification.
 *
 * Regenerates committed generator outputs and fails when the working tree
 * would change. Also runs the wrangler config guard.
 *
 * Usage: node scripts/ci/verify-drift.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(cmd) {
  console.log(`▶ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function quotedPaths(paths) {
  return paths.map((p) => `"${p}"`).join(" ");
}

function gitDiff(paths) {
  try {
    execSync(`git diff --exit-code -- ${quotedPaths(paths)}`, { cwd: ROOT, stdio: "pipe" });
    return "";
  } catch (error) {
    const out = error.stdout?.toString() ?? "";
    const err = error.stderr?.toString() ?? "";
    return out || err || "drift detected";
  }
}

const checks = [
  {
    id: "route-tree",
    regenerate: () => run("bun scripts/generate-route-tree.ts"),
    paths: ["src/routeTree.gen.ts"],
  },
  {
    id: "openapi",
    regenerate: () => run("bun run generate:openapi"),
    paths: ["openapi.json"],
  },
  {
    id: "contract-bindings",
    regenerate: () => run("node scripts/generate-contract-bindings.mjs"),
    paths: ["src/services/stellar/contracts"],
  },
];

const failures = [];

for (const check of checks) {
  check.regenerate();
  const diff = gitDiff(check.paths);
  if (diff) {
    failures.push({
      id: check.id,
      paths: check.paths,
      message: `Generated output drift detected for ${check.id}`,
    });
    console.error(`❌ ${check.id}: drift in ${check.paths.join(", ")}`);
    try {
      execSync(`git --no-pager diff --stat -- ${quotedPaths(check.paths)}`, {
        cwd: ROOT,
        stdio: "inherit",
      });
      execSync(`git --no-pager diff --name-only -- ${quotedPaths(check.paths)}`, {
        cwd: ROOT,
        stdio: "inherit",
      });
    } catch {
      // listing the diff is best-effort
    }
  } else {
    console.log(`✅ ${check.id}: no drift`);
  }
}

console.log("\n▶ config:check");
try {
  run("bun run config:check");
  console.log("✅ config:check passed");
} catch {
  failures.push({ id: "config-check", paths: ["wrangler.toml"], message: "config:check failed" });
}

const versions = JSON.parse(readFileSync(join(ROOT, "scripts/ci/tool-versions.json"), "utf-8"));
const result = {
  gateId: "build-reproducibility",
  name: "Build Reproducibility & Drift",
  owner: "platform/client",
  dependency: "BETA-088",
  status: failures.length === 0 ? "pass" : "fail",
  toolVersions: versions,
  checks: checks.map((c) => ({
    id: c.id,
    paths: c.paths,
    status: failures.some((f) => f.id === c.id) ? "fail" : "pass",
  })),
  failures,
  verifiedAt: new Date().toISOString(),
};

const outPath = join(ROOT, "gate-result-build-reproducibility.json");
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
console.log(`Wrote ${outPath}`);

if (failures.length > 0) {
  console.error("\n❌ Drift verification failed. Regenerate and commit the outputs above.");
  try {
    execSync("git --no-pager diff --name-only", { cwd: ROOT, stdio: "inherit" });
  } catch {
    // ignore
  }
  process.exit(1);
}

console.log("\n✅ All drift checks passed.");
process.exit(0);
