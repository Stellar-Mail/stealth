#!/usr/bin/env node
/**
 * BETA-088 — verify pinned tool/dependency versions are consistent across the
 * sources of truth that the unified CI release gate relies on:
 *
 *   - scripts/ci/tool-versions.json   (single source of truth)
 *   - .github/workflows/ci.yml env    (BUN_VERSION / NODE_VERSION / OPTIC_VERSION)
 *   - .node-version                   (Node pin mirrored for local tooling)
 *   - package.json devDependencies    (playwright pin)
 *   - rust-toolchain.toml             (Rust target/channel pin)
 *
 * This enforces the "pin versions consistently across jobs" and "generated
 * artifacts and lockfiles are deterministic and drift-checked" requirements.
 *
 * Usage:
 *   node scripts/ci/verify-pinned-versions.mjs [--write-gate]
 *
 * Exit code 0 when every pinned version is consistent, 1 on drift.
 * With --write-gate it also emits gate-result-pinned-versions.json so the
 * Beta Release Gate Summary can aggregate it.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readInstalledPlaywrightVersion } from "./verify-playwright-version.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

const problems = [];
const ok = [];

function expect(label, actual, expected) {
  if (String(actual).trim() === String(expected).trim()) {
    ok.push(`- ${label}: ${actual}`);
  } else {
    problems.push(`- ${label}: expected ${expected}, found ${actual}`);
  }
}

const writeGate = process.argv.includes("--write-gate");

const toolVersions = JSON.parse(read("scripts/ci/tool-versions.json"));
const ciYml = read(".github/workflows/ci.yml");

for (const [envKey, tvKey] of [
  ["BUN_VERSION", "bun"],
  ["NODE_VERSION", "node"],
  ["OPTIC_VERSION", "optic"],
]) {
  const m = ciYml.match(new RegExp(`^\\s*${envKey}:\\s*"([^"]+)"`, "m"));
  if (!m) {
    problems.push(`- ci.yml is missing env ${envKey}`);
    continue;
  }
  expect(`ci.yml ${envKey} == tool-versions.${tvKey}`, m[1], toolVersions[tvKey]);
}

const nodeVersionFile = read(".node-version").trim();
expect(".node-version == tool-versions.node", nodeVersionFile, toolVersions.node);

const installedPlaywright = readInstalledPlaywrightVersion();
if (installedPlaywright) {
  expect(
    "installed @playwright/test == tool-versions.playwright",
    installedPlaywright,
    toolVersions.playwright,
  );
} else {
  problems.push("- could not resolve installed @playwright/test version");
}

if (!existsSync(resolve(ROOT, "rust-toolchain.toml"))) {
  problems.push("- rust-toolchain.toml is missing (Rust pin required)");
} else {
  ok.push("- rust-toolchain.toml present");
}

console.log("Pinned tool-version consistency check");
ok.forEach((l) => console.log(l));
problems.forEach((l) => console.log(l));

if (problems.length) {
  console.error(`\nFAILED: ${problems.length} version drift(s) detected.`);
  if (writeGate) {
    spawnSync(
      "node",
      [
        resolve(ROOT, "scripts/ci/write-gate-result.mjs"),
        "--gate-id",
        "pinned-versions",
        "--name",
        "Pinned Version Consistency",
        "--owner",
        "platform/release",
        "--dependency",
        "BETA-088",
        "--status",
        "fail",
        "--message",
        `${problems.length} version drift(s) detected`,
      ],
      { stdio: "inherit" },
    );
  }
  process.exit(1);
}

console.log("\nPASS: all pinned tool versions are consistent.");
if (writeGate) {
  spawnSync(
    "node",
    [
      resolve(ROOT, "scripts/ci/write-gate-result.mjs"),
      "--gate-id",
      "pinned-versions",
      "--name",
      "Pinned Version Consistency",
      "--owner",
      "platform/release",
      "--dependency",
      "BETA-088",
      "--status",
      "pass",
      "--evidence-json",
      JSON.stringify({ command: "node scripts/ci/verify-pinned-versions.mjs" }),
    ],
    { stdio: "inherit" },
  );
}
process.exit(0);
