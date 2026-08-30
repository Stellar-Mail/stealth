#!/usr/bin/env node
/**
 * BETA-099 — Release Candidate freeze runner.
 *
 * Cuts nothing by itself; it exercises the operational loop required by
 * docs/deployment/RELEASE_GATES.md against the working tree so a reviewer can
 * reproduce every automated control locally and feed the results into the same
 * Beta Release Gate Summary job CI uses.
 *
 * Usage:
 *   node scripts/release/rc-freeze.mjs [--commit <sha>] [--evidence-dir <path>]
 *
 * Each gate is executed the same way as `.github/workflows/ci.yml`. Gates that
 * require browser binaries, a live testnet, or the pinned `bun` toolchain are
 * marked `skipped` with a pointer to the CI job that owns them; the PR's CI run
 * is the authoritative source for those results.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const argv = process.argv.slice(2);
function readArg(flag, def) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : def;
}

const commit = readArg("--commit", process.env.GITHUB_SHA ?? "local");
const evidenceDir = readArg("--evidence-dir", join(ROOT, "docs/deployment/rc-evidence"));
mkdirSync(evidenceDir, { recursive: true });

/** A gate that can be executed with node/npm in this environment. */
function localGate(id, name, owner, dependency, cmd, env = {}) {
  return { id, name, owner, dependency, run: "local", cmd, env };
}
/** A gate owned by a CI job that needs bun / browsers / testnet. */
function ciGate(id, name, owner, dependency, job) {
  return { id, name, owner, dependency, run: "ci", job };
}

const BIN = join(ROOT, "node_modules", ".bin");
const GATES = [
  localGate(
    "client-checks",
    "Client Checks",
    "platform/client",
    "BETA-088",
    `${BIN}/tsc --noEmit && ${BIN}/eslint . && ${BIN}/vite build`,
  ),
  localGate(
    "pinned-versions",
    "Pinned Versions",
    "platform/release",
    "BETA-088",
    "node scripts/ci/verify-pinned-versions.mjs",
  ),
  localGate(
    "beta-migrations",
    "Migration Gates",
    "platform/storage",
    "BETA-082",
    "node scripts/identity-migrate.mjs integrity-check && node scripts/identity-migrate.mjs forward --approval approved && node scripts/identity-migrate.mjs rollback --target-version 1 --approval approved",
  ),
  localGate(
    "beta-backup",
    "Backup & Restore Gates",
    "platform/storage",
    "BETA-081",
    "node scripts/backup/backup.mjs rehearsal",
    { STEALTH_BACKUP_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" },
  ),
  ciGate(
    "build-reproducibility",
    "Build Reproducibility & Drift",
    "platform/client",
    "BETA-088",
    "client-checks",
  ),
  ciGate("contract-checks", "Contract Checks", "platform/contracts", "BETA-086", "contract-checks"),
  ciGate(
    "contract-registry",
    "Contract Registry",
    "platform/contracts",
    "BETA-086",
    "contract-registry",
  ),
  ciGate("beta-auth", "Auth & Abuse Gates", "security/platform", "BETA-079", "beta-auth"),
  ciGate(
    "beta-security",
    "Security & Crypto Gates",
    "security/platform",
    "BETA-084",
    "beta-security",
  ),
  ciGate("beta-live-data", "Live-Data No-Mock", "protocol/relay", "BETA-050", "beta-live-data"),
  ciGate(
    "beta-performance",
    "Performance Budget",
    "platform/performance",
    "BETA-083",
    "beta-performance",
  ),
  ciGate("e2e", "E2E & Browser Gates", "platform/client", "BETA-087", "e2e"),
  ciGate("visual-e2e", "Visual & Cross-Browser E2E", "platform/client", "BETA-087", "visual-e2e"),
  ciGate("security", "Security & Dependency Review", "security/platform", "BETA-088", "security"),
  ciGate("provenance", "Provenance & Hashes", "platform/release", "BETA-088", "provenance"),
  ciGate(
    "beta-soroban-live",
    "Soroban Live Integration",
    "platform/contracts",
    "BETA-086",
    "beta-live-testnet",
  ),
];

function runLocal(cmd, env) {
  const res = spawnSync(cmd, {
    shell: true,
    cwd: ROOT,
    encoding: "utf-8",
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = [res.stdout ?? "", res.stderr ?? ""].join("\n").trimEnd();
  return {
    exitCode: res.status ?? (res.error ? 1 : 0),
    excerpt: out.split("\n").slice(-25).join("\n"),
  };
}

const results = [];
for (const gate of GATES) {
  if (gate.run === "local") {
    console.log(`▶ running ${gate.id}`);
    const { exitCode, excerpt } = runLocal(gate.cmd, gate.env);
    const status = exitCode === 0 ? "pass" : "fail";
    results.push({
      gateId: gate.id,
      name: gate.name,
      owner: gate.owner,
      dependency: gate.dependency,
      status,
      message: status === "pass" ? "Executed locally." : `Local command exited ${exitCode}.`,
      evidence: { command: gate.cmd, exitCode, excerpt },
      verifiedAt: new Date().toISOString(),
    });
    console.log(`  ${status} (exit ${exitCode})`);
  } else {
    results.push({
      gateId: gate.id,
      name: gate.name,
      owner: gate.owner,
      dependency: gate.dependency,
      status: "skipped",
      message: `Owned by CI job '${gate.job}' (.github/workflows/ci.yml). Authoritative result produced by the PR CI run.`,
      evidence: { ciJob: gate.job },
      verifiedAt: new Date().toISOString(),
    });
    console.log(`  skipped (CI job ${gate.job})`);
  }
}

for (const r of results) {
  writeFileSync(
    join(evidenceDir, `gate-result-${r.gateId}.json`),
    JSON.stringify(r, null, 2) + "\n",
    "utf-8",
  );
}

// Generate the same release-gate summary CI produces.
spawnSync(
  "node",
  ["scripts/ci/release-gate-summary.mjs", "--input-dir", evidenceDir, "--commit", commit],
  { stdio: "inherit", cwd: ROOT },
);

console.log(`\nEvidence written to ${evidenceDir}`);
