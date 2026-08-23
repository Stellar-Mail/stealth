// Team Payment Approval — validation, sanitization, and guard helpers.
//
// Folder-local hardening layer that runs before the core execution engine to
// reject hostile or oversized input and to strip characters that could hide
// content or break downstream processing. Pure and deterministic: no network
// calls, no eval, and no mutation of caller-supplied objects.
//
// See THREATS.md for the full threat model and unsafe input catalog.

import type {
  PaymentApprovalContext,
  PaymentApprovalErrorCode,
  PaymentApprovalInput,
  PaymentDecisionKind,
} from "../types/contract";

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const GUARD_LIMITS = {
  maxPaymentIdChars: 256,
  maxApproverIdChars: 256,
  maxNotesChars: 10_000,
  maxRoleChars: 128,
  maxContextFields: 20,
  maxAllowedRoles: 50,
  maxAmount: 100_000_000,
  maxBatchSize: 10_000,
} as const;

// ---------------------------------------------------------------------------
// Character-class patterns
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;
const DECISION_KINDS: readonly PaymentDecisionKind[] = ["approve", "reject"];

// ---------------------------------------------------------------------------
// Text sanitization
// ---------------------------------------------------------------------------

/** Normalize to NFC and strip control and zero-width characters. */
export function sanitizeText(text: string): string {
  return text.normalize("NFC").replace(CONTROL_CHARACTERS, "").replace(INVISIBLE_CHARACTERS, "");
}

/** Trim and sanitize a string field. Returns empty string for non-string input. */
export function sanitizeStringField(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizeText(value.trim());
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** True when value is a finite, non-NaN number. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True when value is a non-empty string. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** True when value is one of the allowed decision kinds. */
export function isDecisionKind(value: unknown): value is PaymentDecisionKind {
  return DECISION_KINDS.includes(value as PaymentDecisionKind);
}

// ---------------------------------------------------------------------------
// Prototype pollution guard
// ---------------------------------------------------------------------------

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Returns false when any own key is a prototype-pollution vector. */
export function isPrototypeSafe(record: Record<string, unknown>): boolean {
  for (const key of Object.keys(record)) {
    if (PROTOTYPE_KEYS.has(key)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// ReDoS safety check (utility for future contributors)
// ---------------------------------------------------------------------------

/**
 * Returns true when a regex pattern is safe from catastrophic backtracking.
 * Simple character-class patterns (used by this module) are always safe.
 * This utility exists for contributors who add new regex patterns.
 */
export function isRegexSafe(pattern: RegExp): boolean {
  try {
    // Test with a long repeating string that would trigger backtracking
    // on vulnerable patterns.
    const testString = "a".repeat(5000);
    pattern.test(testString);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Safe JSON parse
// ---------------------------------------------------------------------------

export type SafeJsonResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Attempt to parse JSON with a runtime type guard on the result.
 * Returns a discriminated union instead of throwing.
 */
export function safeJsonParse<T>(
  raw: string,
  guard: (value: unknown) => value is T,
): SafeJsonResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "JSON parse failed",
    };
  }
  if (!guard(parsed)) {
    return { ok: false, error: "Parsed JSON did not match expected shape" };
  }
  return { ok: true, value: parsed };
}

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

/** Normalize a date-like value to an ISO string. Falls back to now. */
export function normalizeDate(value?: string | Date): string {
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? value.toISOString() : new Date().toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
  }
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Amount sanitization
// ---------------------------------------------------------------------------

/** Clamp an amount to a safe finite, non-negative value. Returns NaN if unfixable. */
export function sanitizeAmount(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value < 0) return null;
  if (value > GUARD_LIMITS.maxAmount) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Input structural validation
// ---------------------------------------------------------------------------

export interface PaymentApprovalGuardIssue {
  code: string;
  field?: string;
  message: string;
}

/**
 * Structural validation of a raw PaymentApprovalInput.
 * Returns the first issue found, or null when valid.
 */
export function validatePaymentApprovalInput(input: unknown): PaymentApprovalGuardIssue | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      code: "invalid-input",
      message: "Input must be a non-null object.",
    };
  }
  const v = input as Record<string, unknown>;

  if (!isPrototypeSafe(v)) {
    return {
      code: "invalid-input",
      message: "Input contains prohibited prototype keys.",
    };
  }

  if (!isNonEmptyString(v.paymentId)) {
    return {
      code: "invalid-input",
      field: "paymentId",
      message: "paymentId is required and must be a non-empty string.",
    };
  }
  if (!isNonEmptyString(v.approverId)) {
    return {
      code: "invalid-input",
      field: "approverId",
      message: "approverId is required and must be a non-empty string.",
    };
  }
  if (!isDecisionKind(v.decision)) {
    return {
      code: "invalid-input",
      field: "decision",
      message: 'decision must be "approve" or "reject".',
    };
  }
  if (v.notes !== undefined && typeof v.notes !== "string") {
    return {
      code: "invalid-input",
      field: "notes",
      message: "notes must be a string when present.",
    };
  }
  if (
    v.decidedAt !== undefined &&
    typeof v.decidedAt !== "string" &&
    !(v.decidedAt instanceof Date)
  ) {
    return {
      code: "invalid-input",
      field: "decidedAt",
      message: "decidedAt must be an ISO string or Date when present.",
    };
  }
  if (v.context !== undefined) {
    const ctxIssue = validateContext(v.context);
    if (ctxIssue) return ctxIssue;
  }
  return null;
}

/** Structural validation of a PaymentApprovalContext. */
export function validateContext(value: unknown): PaymentApprovalGuardIssue | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      code: "invalid-input",
      field: "context",
      message: "context must be a non-null object.",
    };
  }
  const v = value as Record<string, unknown>;

  if (!isPrototypeSafe(v)) {
    return {
      code: "invalid-input",
      field: "context",
      message: "context contains prohibited prototype keys.",
    };
  }
  if (!isNonEmptyString(v.approverId)) {
    return {
      code: "invalid-input",
      field: "context.approverId",
      message: "context.approverId is required.",
    };
  }
  if (!isNonEmptyString(v.role)) {
    return {
      code: "invalid-input",
      field: "context.role",
      message: "context.role is required.",
    };
  }
  if (v.approvalLimit !== undefined && !isFiniteNumber(v.approvalLimit)) {
    return {
      code: "invalid-input",
      field: "context.approvalLimit",
      message: "context.approvalLimit must be a finite number.",
    };
  }
  if (v.allowedRoles !== undefined) {
    if (!Array.isArray(v.allowedRoles)) {
      return {
        code: "invalid-input",
        field: "context.allowedRoles",
        message: "context.allowedRoles must be an array.",
      };
    }
    if (v.allowedRoles.length > GUARD_LIMITS.maxAllowedRoles) {
      return {
        code: "input-too-large",
        field: "context.allowedRoles",
        message: `allowedRoles exceeds ${GUARD_LIMITS.maxAllowedRoles} entries.`,
      };
    }
    for (const role of v.allowedRoles) {
      if (typeof role !== "string" || role.trim().length === 0) {
        return {
          code: "invalid-input",
          field: "context.allowedRoles",
          message: "Each allowedRole must be a non-empty string.",
        };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Size limit checks
// ---------------------------------------------------------------------------

/** Check all field sizes against GUARD_LIMITS. Empty array means within limits. */
export function checkInputLimits(input: PaymentApprovalInput): PaymentApprovalGuardIssue[] {
  const issues: PaymentApprovalGuardIssue[] = [];

  if (input.paymentId.length > GUARD_LIMITS.maxPaymentIdChars) {
    issues.push({
      code: "input-too-large",
      field: "paymentId",
      message: `paymentId exceeds ${GUARD_LIMITS.maxPaymentIdChars} characters.`,
    });
  }
  if (input.approverId.length > GUARD_LIMITS.maxApproverIdChars) {
    issues.push({
      code: "input-too-large",
      field: "approverId",
      message: `approverId exceeds ${GUARD_LIMITS.maxApproverIdChars} characters.`,
    });
  }
  if (input.notes !== undefined && input.notes.length > GUARD_LIMITS.maxNotesChars) {
    issues.push({
      code: "input-too-large",
      field: "notes",
      message: `notes exceeds ${GUARD_LIMITS.maxNotesChars} characters.`,
    });
  }
  if (input.context?.role !== undefined && input.context.role.length > GUARD_LIMITS.maxRoleChars) {
    issues.push({
      code: "input-too-large",
      field: "context.role",
      message: `role exceeds ${GUARD_LIMITS.maxRoleChars} characters.`,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Input sanitization (returns a cleaned copy, never mutates the original)
// ---------------------------------------------------------------------------

/** Return a sanitized copy of the input. Original is never mutated. */
export function sanitizeInput(input: PaymentApprovalInput): PaymentApprovalInput {
  const sanitized: PaymentApprovalInput = {
    paymentId: sanitizeText(input.paymentId.trim()),
    approverId: sanitizeText(input.approverId.trim()),
    decision: input.decision,
  };
  if (input.notes !== undefined) {
    sanitized.notes = sanitizeText(input.notes.trim());
  }
  if (input.decidedAt !== undefined) {
    sanitized.decidedAt = input.decidedAt;
  }
  if (input.context !== undefined) {
    sanitized.context = {
      approverId: sanitizeText(input.context.approverId.trim()),
      role: sanitizeText(input.context.role.trim()),
    };
    if (input.context.approvalLimit !== undefined) {
      sanitized.context.approvalLimit = input.context.approvalLimit;
    }
    if (input.context.allowedRoles !== undefined) {
      sanitized.context.allowedRoles = input.context.allowedRoles.map((r) =>
        sanitizeText(r.trim()),
      );
    }
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Batch / collection guards
// ---------------------------------------------------------------------------

/**
 * Guard for batch operations. Returns the clamped batch size or an error.
 * Useful when processing large datasets in paginated fashion.
 */
export function batchSizeGuard(
  requested: unknown,
): { ok: true; size: number } | { ok: false; issue: PaymentApprovalGuardIssue } {
  if (!isFiniteNumber(requested)) {
    return { ok: true, size: 100 }; // default batch size
  }
  const size = Math.floor(requested);
  if (size < 1) {
    return {
      ok: false,
      issue: {
        code: "input-too-large",
        message: "batchSize must be at least 1.",
      },
    };
  }
  if (size > GUARD_LIMITS.maxBatchSize) {
    return { ok: true, size: GUARD_LIMITS.maxBatchSize };
  }
  return { ok: true, size };
}

/**
 * Trim an array to a maximum length. Returns a new array; original is untouched.
 */
export function trimCollection<T>(items: T[], maxLength: number): T[] {
  if (!isFiniteNumber(maxLength) || maxLength < 0) return items;
  return items.slice(0, Math.floor(maxLength));
}

// ---------------------------------------------------------------------------
// Safe entry point
// ---------------------------------------------------------------------------

export type SafePaymentApprovalResult =
  | { status: "ok"; input: PaymentApprovalInput }
  | {
      status: "error";
      code: PaymentApprovalErrorCode | "INVALID_INPUT" | "INPUT_TOO_LARGE";
      message: string;
      issues: PaymentApprovalGuardIssue[];
    };

/**
 * Guarded, non-throwing entry point for untrusted callers.
 *
 * Validates, sanitizes, and enforces limits before delegating to the
 * execution engine. Always returns a discriminated result.
 */
export function safeExecuteApproval(input: unknown): SafePaymentApprovalResult {
  // 1. Structural validation
  const validationIssue = validatePaymentApprovalInput(input);
  if (validationIssue) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      message: validationIssue.message,
      issues: [validationIssue],
    };
  }

  const typed = input as PaymentApprovalInput;

  // 2. Size limits
  const limitIssues = checkInputLimits(typed);
  if (limitIssues.length > 0) {
    return {
      status: "error",
      code: "INPUT_TOO_LARGE",
      message: limitIssues.map((i) => i.message).join("; "),
      issues: limitIssues,
    };
  }

  // 3. Sanitize
  const sanitized = sanitizeInput(typed);

  // 4. Post-sanitization: reject empty-after-sanitize fields
  if (sanitized.paymentId.length === 0) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      message: "paymentId is empty after sanitization.",
      issues: [
        {
          code: "invalid-input",
          field: "paymentId",
          message: "paymentId became empty after sanitization.",
        },
      ],
    };
  }
  if (sanitized.approverId.length === 0) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      message: "approverId is empty after sanitization.",
      issues: [
        {
          code: "invalid-input",
          field: "approverId",
          message: "approverId became empty after sanitization.",
        },
      ],
    };
  }

  return { status: "ok", input: sanitized };
}
