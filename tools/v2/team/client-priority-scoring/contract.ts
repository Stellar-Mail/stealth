/**
 * contract.ts — Client Priority Scoring (non-UI execution contract)
 *
 * Backend-facing execution contract for ranking clients by importance. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `PriorityResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 */

import type { ClientForScoring, ScoreClientsInput, ScoredClient, PriorityOrder } from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum PriorityErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
}

/** Discriminated outcome returned by every contract operation. */
export type PriorityResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PriorityErrorCode; message: string };

/** Operations supported by the priority contract. */
export type PriorityOperation = {
  operation: "score";
  input: ScoreClientsInput;
  order?: PriorityOrder;
};

/** Output produced by the contract, keyed by operation. */
export type PriorityContractOutput = {
  operation: "score";
  ranked: ScoredClient[];
};

/** Backend-facing entry point for client priority scoring. */
export interface PriorityContract {
  execute(input: PriorityOperation): PriorityResult<PriorityContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): PriorityResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: PriorityErrorCode, message: string): PriorityResult<T> {
  return { ok: false, error, message };
}

/** Validate a client for scoring. */
export function validateClient(client: ClientForScoring): string | null {
  if (!client.id || client.id.trim() === "") return "client requires an id";
  if (!client.name || client.name.trim() === "") return "client requires a name";
  if (!Array.isArray(client.signals)) return "client.signals must be an array";
  for (const s of client.signals) {
    if (typeof s.value !== "number" || Number.isNaN(s.value))
      return `signal ${s.name} has a non-numeric value`;
    if (typeof s.weight !== "number" || s.weight < 0)
      return `signal ${s.name} has a negative weight`;
  }
  return null;
}

function band(score: number, high: number, low: number): ScoredClient["priority"] {
  if (score >= high) return "high";
  if (score < low) return "low";
  return "medium";
}

/**
 * Pure scoring + ranking. Computes a weighted score per client, derives a
 * priority band, then orders clients by score (desc by default).
 *
 * Deterministic given the same inputs.
 */
export function scoreClients(
  input: ScoreClientsInput,
  order: PriorityOrder = "desc",
): ScoredClient[] {
  const high = input.highThreshold ?? 10;
  const low = input.lowThreshold ?? 3;
  const scored: ScoredClient[] = input.clients.map((client) => {
    const score = client.signals.reduce((sum, s) => sum + s.value * s.weight, 0);
    return {
      id: client.id,
      name: client.name,
      score,
      priority: band(score, high, low),
    };
  });
  const dir = order === "asc" ? 1 : -1;
  return scored.sort((a, b) => dir * (a.score - b.score));
}

/** Validate the whole input before scoring. */
export function validateScoreInput(input: ScoreClientsInput): string | null {
  if (!input || !Array.isArray(input.clients)) return "clients must be an array";
  for (const client of input.clients) {
    const err = validateClient(client);
    if (err) return err;
  }
  return null;
}
