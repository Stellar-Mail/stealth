#!/usr/bin/env bun
/**
 * BETA-095 repeatable verification script.
 *
 * Exercises the operator / security-tester / beta-user journeys against the real
 * beta control code paths (the same handlers and BetaControlService that run in
 * production) and validates the captured, redacted evidence artifact.
 *
 * Usage:  bun scripts/beta/verify-beta-controls.mjs
 *
 * This never reads or prints secrets, tokens, seeds, or private keys.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EVIDENCE_PATH = "scripts/beta/beta-controls-evidence.json";
const SECRET_PATTERN = /(password|secret|token|seed|privatekey|api[_-]?key|cursorsecret)/i;
const RAW_KEY_PATTERN = /G[A-Z0-9]{55,}/;

function step(name, fn) {
  process.stdout.write(`• ${name} ... `);
  fn();
  process.stdout.write("ok\n");
}

try {
  step("Running BETA-095 journey integration tests", () => {
    execSync("bun x vitest run tests/unit/api/beta-controls.workflow.test.ts --reporter=dot", {
      stdio: "inherit",
    });
  });

  let evidence;
  step("Loading redacted evidence artifact", () => {
    if (!existsSync(EVIDENCE_PATH)) {
      throw new Error(`Evidence artifact missing: ${EVIDENCE_PATH}`);
    }
    evidence = JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
  });

  step("Asserting evidence is redacted (no secrets, no raw keys)", () => {
    const serialized = JSON.stringify(evidence);
    if (SECRET_PATTERN.test(serialized)) {
      throw new Error("Secret material detected in evidence artifact.");
    }
    if (RAW_KEY_PATTERN.test(serialized)) {
      throw new Error("Raw Stellar secret/seed detected in evidence artifact.");
    }
  });

  step("Asserting all three journeys recorded an outcome", () => {
    const journeys = evidence.journeys ?? {};
    for (const key of ["operator", "securityTester", "betaUser", "recovery", "rollback"]) {
      if (!journeys[key]) throw new Error(`Journey '${key}' has no recorded outcome.`);
    }
  });

  step("Asserting kill-switch denial and recovery are proven", () => {
    const { betaUser, recovery } = evidence.journeys;
    if (betaUser.denialStatus !== 503) throw new Error("Expected denial status 503.");
    if (recovery.retryStatus === 503) throw new Error("Expected recovery to pass the kill switch.");
  });

  console.log("\nBETA-095 verification summary (redacted):");
  console.log(
    JSON.stringify(
      {
        task: evidence.task,
        gitCommit: evidence.identifiers?.gitCommit,
        journeys: Object.keys(evidence.journeys ?? {}),
        controlConfig: evidence.identifiers?.controlConfig,
      },
      null,
      2,
    ),
  );
  console.log("\nVERIFICATION OK");
  process.exit(0);
} catch (error) {
  console.error(`\nVERIFICATION FAILED: ${error?.message ?? error}`);
  process.exit(1);
}
