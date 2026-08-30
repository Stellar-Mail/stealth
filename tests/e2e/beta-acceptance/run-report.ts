/**
 * Redacted acceptance session report writer (BETA-098 / #2005).
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPORT_PATH = resolve(__dirname, "run-report.json");

export interface AcceptanceStep {
  journeyId: string;
  viewport: "desktop" | "mobile";
  status: "pass" | "fail" | "blocked" | "denied";
  elapsedMs?: number;
  controlOwner: string;
}

export interface AcceptanceRunReport {
  issue: "BETA-098";
  runAt: string;
  mode: "local-fake" | "facilitated";
  toolVersions: Record<string, string>;
  metricsTargets: Record<string, number>;
  steps: AcceptanceStep[];
  notes?: string;
}

export function writeAcceptanceReport(report: AcceptanceRunReport): void {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf-8");
}
