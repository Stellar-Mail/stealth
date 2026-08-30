#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveBetaAcceptanceStatus } from "./beta-acceptance-gate-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);

function readArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const evidencePath = readArg("--evidence") ?? join(ROOT, "gate-result-beta-098-acceptance.json");
const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf-8")) : null;

const derived = deriveBetaAcceptanceStatus({
  journeysOutcome: readArg("--journeys") ?? "failure",
  evidence,
});

const write = spawnSync(
  process.execPath,
  [
    join(ROOT, "scripts/ci/write-gate-result.mjs"),
    "--gate-id",
    "beta-acceptance",
    "--name",
    "Beta Usability & Accessibility Acceptance",
    "--owner",
    "product/ux",
    "--dependency",
    "BETA-098",
    "--status",
    derived.status,
    ...(derived.message ? ["--message", derived.message] : []),
  ],
  { cwd: ROOT, stdio: "inherit" },
);

process.exit(write.status === 0 ? 0 : 1);
