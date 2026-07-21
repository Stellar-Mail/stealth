/**
 * contract.fixtures.ts — Suspicious Sender Watchlist (execution contract)
 *
 * Representative input/output samples for the non-UI execution contract.
 * Used by the contract tests and as documentation of the contract shape.
 */

import type { WatchlistContractInput } from "../contract";
import type { AddEntryInput, UpdateRiskInput } from "../types";

/** A valid "add" payload (happy path). */
export const VALID_ADD_INPUT: AddEntryInput = {
  senderEmail: "spoof@trusted-bank.example.com",
  senderName: "Trusted Bank",
  reason: "Impersonating a known financial institution",
  riskLevel: "high",
  notes: "Reported by security team",
};

/** A valid "updateRisk" payload (happy path). */
export const VALID_UPDATE_RISK_INPUT: UpdateRiskInput = {
  id: "watch-001",
  riskLevel: "medium",
};

/** Sample contract inputs covering each operation. */
export const SAMPLE_CONTRACT_INPUTS: WatchlistContractInput[] = [
  { operation: "list" },
  { operation: "list", filter: { riskLevel: "high" } },
  { operation: "add", input: VALID_ADD_INPUT },
  { operation: "updateRisk", input: VALID_UPDATE_RISK_INPUT },
  { operation: "dismiss", id: "watch-002" },
  { operation: "remove", id: "watch-003" },
  { operation: "metrics" },
];
