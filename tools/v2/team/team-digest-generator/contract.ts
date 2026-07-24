/**
 * contract.ts — Team Digest Generator (non-UI execution contract)
 *
 * Backend-facing execution contract for generating a team digest. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `DigestResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 *
 * The underlying aggregation logic already exists in `./src/digestGenerator`
 * (`generateTeamDigest`); this contract wraps it with a typed boundary.
 */

import {
  generateTeamDigest,
  type TeamDigestItem,
  type TeamDigestSummary,
} from "./src/digestGenerator";

/** Explicit, machine-readable error codes for contract operations. */
export enum DigestErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
}

/** Discriminated outcome returned by every contract operation. */
export type DigestResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DigestErrorCode; message: string };

/** Operations supported by the digest contract. */
export type DigestOperation = {
  operation: "generate";
  items: TeamDigestItem[];
  options?: { topSubjectLimit?: number };
};

/** Output produced by the contract, keyed by operation. */
export type DigestContractOutput = {
  operation: "generate";
  summary: TeamDigestSummary;
};

/** Backend-facing entry point for the team digest generator. */
export interface DigestContract {
  execute(input: DigestOperation): DigestResult<DigestContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): DigestResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: DigestErrorCode, message: string): DigestResult<T> {
  return { ok: false, error, message };
}

/** Validate digest input items. */
export function validateDigestInput(items: TeamDigestItem[] | undefined): string | null {
  if (!items) return "items are required";
  if (!Array.isArray(items)) return "items must be an array";
  for (const item of items) {
    if (!item.id || item.id.trim() === "") return "each item requires an id";
    if (!item.author || item.author.trim() === "") return "each item requires an author";
  }
  return null;
}

/**
 * Build the team digest execution contract.
 *
 * Pure: delegates aggregation to `generateTeamDigest`, returning a typed
 * result. State never escapes the function, so it is fully testable in
 * isolation with no network, no secrets, and no UI.
 */
export function createDigestContract(): DigestContract {
  return {
    execute(input: DigestOperation): DigestResult<DigestContractOutput> {
      try {
        if (input.operation !== "generate") {
          return fail(DigestErrorCode.InvalidInput, `Unknown operation: ${input.operation}`);
        }
        const err = validateDigestInput(input.items);
        if (err) return fail(DigestErrorCode.InvalidInput, err);
        const summary = generateTeamDigest(input.items, input.options);
        return ok({ operation: "generate", summary });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(DigestErrorCode.InvalidInput, message);
      }
    },
  };
}
