/**
 * Non-UI execution contract for the Legal & Compliance Review Flag tool.
 *
 * This module is backend-facing only. It defines the typed inputs, outputs,
 * and failure modes for flagging a resource for legal/compliance review, and
 * is intentionally free of any presentation, React, or DOM dependencies so it
 * can be invoked identically by a UI, a cron job, or a CLI.
 *
 * The pure entrypoint is {@link createReviewFlag}. All side effects (auth
 * checks, persistence, id/time generation) are injected through
 * {@link ReviewFlagDependency} so the contract stays deterministic and
 * unit-testable without a database or network.
 */

export type ReviewFlagSeverity = "low" | "medium" | "high" | "critical";

export type ReviewStatus = "open" | "in_review" | "escalated" | "resolved" | "dismissed";

export type ReviewFlagErrorCode =
  | "invalid_input"
  | "unauthorized_reviewer"
  | "duplicate_flag"
  | "resource_not_found"
  | "policy_conflict";

export interface ReviewFlagInput {
  /** Identifier of the actor raising the flag (resolved against authz). */
  reviewer: string;
  /** Opaque identifier of the resource being flagged (e.g. `mail:thread:abc`). */
  targetResource: string;
  /** Human-readable rationale; must be non-empty and within length bounds. */
  flagReason: string;
  severity: ReviewFlagSeverity;
  /** Optional external references (scan ids, ticket urls) supporting the flag. */
  evidenceRefs?: readonly string[];
}

export interface ReviewFlagResult {
  flagId: string;
  status: ReviewStatus;
  reviewState: "pending" | "assigned" | "completed";
  timestamp: number;
  /** Append-only, machine-readable trail of what produced this flag. */
  auditTrail: readonly string[];
}

export type ReviewFlagError =
  | { code: "invalid_input"; message: string; fields?: readonly string[] }
  | { code: "unauthorized_reviewer"; message: string }
  | { code: "duplicate_flag"; message: string; existingFlagId?: string }
  | { code: "resource_not_found"; message: string; resource?: string }
  | { code: "policy_conflict"; message: string; detail?: string };

export type ReviewFlagOutcome = ReviewFlagResult | ReviewFlagError;

/**
 * Side-effecting boundaries the contract relies on. Implementations live
 * outside this folder (database, auth service, clock) so the contract itself
 * has no I/O dependencies.
 */
export interface ReviewFlagDependency {
  resolveReviewer(reviewer: string): Promise<boolean> | boolean;
  resourceExists(targetResource: string): Promise<boolean> | boolean;
  findExistingFlag(targetResource: string): Promise<string | null> | string | null;
  persistFlag(input: ReviewFlagInput, result: ReviewFlagResult): Promise<void> | void;
  now(): number;
  generateId(): string;
}

const VALID_SEVERITIES: readonly ReviewFlagSeverity[] = ["low", "medium", "high", "critical"];

const MAX_REASON_LENGTH = 2000;

function invalidFields(input: ReviewFlagInput): string[] {
  const fields: string[] = [];
  if (typeof input.reviewer !== "string" || input.reviewer.trim() === "") {
    fields.push("reviewer");
  }
  if (typeof input.targetResource !== "string" || input.targetResource.trim() === "") {
    fields.push("targetResource");
  }
  if (typeof input.flagReason !== "string" || input.flagReason.trim() === "") {
    fields.push("flagReason");
  } else if (input.flagReason.length > MAX_REASON_LENGTH) {
    fields.push("flagReason");
  }
  if (!VALID_SEVERITIES.includes(input.severity)) {
    fields.push("severity");
  }
  return fields;
}

/**
 * Raise a legal/compliance review flag for a resource.
 *
 * Returns a discriminated {@link ReviewFlagResult} on success or a typed
 * {@link ReviewFlagError} describing the exact failure mode. It never throws
 * for expected domain failures, so callers can branch on `outcome.code`.
 */
export async function createReviewFlag(
  input: ReviewFlagInput,
  deps: ReviewFlagDependency,
): Promise<ReviewFlagOutcome> {
  const fields = invalidFields(input);
  if (fields.length > 0) {
    return {
      code: "invalid_input",
      message: "One or more required fields were missing or malformed.",
      fields,
    };
  }

  const authorized = await deps.resolveReviewer(input.reviewer);
  if (!authorized) {
    return {
      code: "unauthorized_reviewer",
      message: `Reviewer '${input.reviewer}' is not authorized to raise compliance flags.`,
    };
  }

  const exists = await deps.resourceExists(input.targetResource);
  if (!exists) {
    return {
      code: "resource_not_found",
      message: `Target resource '${input.targetResource}' does not exist.`,
      resource: input.targetResource,
    };
  }

  const existing = await deps.findExistingFlag(input.targetResource);
  if (existing) {
    return {
      code: "duplicate_flag",
      message: `An open flag already exists for '${input.targetResource}'.`,
      existingFlagId: existing,
    };
  }

  const timestamp = deps.now();
  const flagId = deps.generateId();
  const auditTrail = [
    `flag.created id=${flagId}`,
    `flag.reviewer=${input.reviewer}`,
    `flag.resource=${input.targetResource}`,
    `flag.severity=${input.severity}`,
    `flag.reason.length=${input.flagReason.length}`,
    ...(input.evidenceRefs && input.evidenceRefs.length > 0
      ? [`flag.evidence.count=${input.evidenceRefs.length}`]
      : []),
  ];

  const result: ReviewFlagResult = {
    flagId,
    status: "open",
    reviewState: "pending",
    timestamp,
    auditTrail,
  };

  await deps.persistFlag(input, result);
  return result;
}

/** Narrowing guard for {@link ReviewFlagOutcome}. */
export function isReviewFlagError(outcome: ReviewFlagOutcome): outcome is ReviewFlagError {
  return (outcome as ReviewFlagError).code !== undefined;
}
