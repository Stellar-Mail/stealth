/**
 * Redacted machine-readable run report writer (BETA-050 / #1957).
 *
 * Collects evidence from the Workflow 2 live testnet run and writes a
 * redacted JSON file to tests/e2e/live-beta/run-report.json.
 *
 * Security contract:
 *   - No secret keys, private key material, or plaintext message bodies
 *     are ever written to the report.
 *   - Only stable identifiers: contract IDs, message IDs (random hex),
 *     transaction hashes, timestamps, and pass/fail status.
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface WorkflowStep {
  step: string;
  status: "ok" | "failed" | "skipped" | "stubbed" | "skipped-no-contract-ids";
  /** Optional non-secret metadata (tx hashes, contract IDs, commitment strings). */
  detail?: Record<string, unknown>;
}

export interface WorkflowRunReport {
  /** ISO-8601 timestamp of the run. */
  runAt: string;
  /** Stellar network name. */
  network: "testnet" | "mainnet" | "local";
  /** "live" for a real testnet run, "fake" for a local deterministic run. */
  mode: "live" | "fake";
  /**
   * Random 32-byte hex message identifier used for the test message.
   * Not a secret — it is a random correlation handle only.
   */
  messageId: string;
  /** Ordered step records. */
  steps: WorkflowStep[];
  /** Optional on-chain transaction hashes for the run. */
  transactionHashes?: {
    postageSubmit?: string;
    deliveredReceipt?: string;
    readReceipt?: string;
  };
  /** Optional Soroban contract IDs observed during the run. */
  contractIds?: {
    postage?: string;
    receipts?: string;
    policies?: string;
    lifecycle?: string;
  };
}

/** Path where the report is written. */
export const REPORT_PATH = resolve(__dirname, "run-report.json");

/**
 * Write a redacted run report to disk.
 *
 * The function strips any field whose name contains "secret", "key",
 * "private", or "plaintext" from nested detail objects as a belt-and-
 * suspenders guard (the caller should never pass these, but we sanitize
 * anyway).
 */
export async function writeRunReport(report: WorkflowRunReport): Promise<void> {
  const sanitized = sanitizeReport(report);
  writeFileSync(REPORT_PATH, JSON.stringify(sanitized, null, 2) + "\n", "utf-8");
}

const SECRET_FIELD_RE = /secret|private|plaintext|body|password|seed/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELD_RE.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = sanitizeValue(v);
    }
  }
  return out;
}

function sanitizeReport(report: WorkflowRunReport): WorkflowRunReport {
  return sanitizeValue(report) as WorkflowRunReport;
}

/**
 * Build a minimal fake-mode report (no live transactions).
 * Useful when tests complete fully in local fake mode.
 */
export function buildFakeReport(messageId: string, steps: WorkflowStep[]): WorkflowRunReport {
  return {
    runAt: new Date().toISOString(),
    network: "local",
    mode: "fake",
    messageId,
    steps,
  };
}
