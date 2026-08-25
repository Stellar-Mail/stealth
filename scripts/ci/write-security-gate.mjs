#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSecretScanStatus } from "./security-gate-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);

function readArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const derived = deriveSecretScanStatus({
  forkPr: readArg("--fork") ?? process.env.FORK_PR,
  depReview: readArg("--dep-review") ?? "skipped",
  gitleaksInstall: readArg("--gitleaks-install") ?? "skipped",
  gitleaksScan: readArg("--gitleaks-scan") ?? "skipped",
});

const write = spawnSync(
  process.execPath,
  [
    join(ROOT, "scripts/ci/write-gate-result.mjs"),
    "--gate-id",
    "security",
    "--name",
    "Security & Dependency Review",
    "--owner",
    "security/platform",
    "--dependency",
    "BETA-088",
    "--status",
    derived.status,
    ...(derived.message ? ["--message", derived.message] : []),
  ],
  { cwd: ROOT, stdio: "inherit" },
);

process.exit(write.status === 0 ? 0 : 1);
