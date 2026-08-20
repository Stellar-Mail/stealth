// ---------------------------------------------------------------------------
// BETA-061 (Issue #1968) — shared policy validation.
//
// Pure functions that validate mailbox policy edits. Used by the shared
// `usePolicyEditor` hook and potentially by future server-side validation.
// No React, no I/O — deterministic and fully unit-testable.
// ---------------------------------------------------------------------------

import type { MailboxPolicy, MailboxPolicyWrite, SenderRule } from "@/lib/api/types";

/** Maximum allowed minimum postage in XLM. */
export const MAX_POSTAGE_XLM = "1";

/** Validates a minimumPostage string. Returns an error message or null. */
export function validateMinimumPostage(value: string): string | null {
  if (value === "") return "Minimum postage is required.";

  const num = Number(value);
  if (!Number.isFinite(num)) return "Enter a valid number.";
  if (num < 0) return "Postage cannot be negative.";
  if (num > Number(MAX_POSTAGE_XLM)) return `Postage cannot exceed ${MAX_POSTAGE_XLM} XLM.`;

  return null;
}

/** Validates a complete policy write payload. Returns a field→error map (empty = valid). */
export function validatePolicyWrite(policy: MailboxPolicyWrite): Record<string, string> {
  const errors: Record<string, string> = {};

  const postageError = validateMinimumPostage(policy.minimumPostage);
  if (postageError) errors.minimumPostage = postageError;

  // requireVerified only makes sense when allowUnknown is true
  if (policy.requireVerified && !policy.allowUnknown) {
    errors.requireVerified = "Verification cannot be required when unknown senders are disabled.";
  }

  return errors;
}

/** Deep equality check for two MailboxPolicy values. */
export function policiesEqual(a: MailboxPolicy, b: MailboxPolicy): boolean {
  return (
    a.allowUnknown === b.allowUnknown &&
    a.requireVerified === b.requireVerified &&
    a.minimumPostage === b.minimumPostage
  );
}

/** Returns an array of field names that differ between draft and live. */
export function computeDirtyFields(draft: MailboxPolicy, live: MailboxPolicy): string[] {
  const dirty: string[] = [];
  if (draft.allowUnknown !== live.allowUnknown) dirty.push("allowUnknown");
  if (draft.requireVerified !== live.requireVerified) dirty.push("requireVerified");
  if (draft.minimumPostage !== live.minimumPostage) dirty.push("minimumPostage");
  return dirty;
}

/**
 * Guard: a user cannot set a sender rule that blocks their own address.
 * Returns an error message or null.
 */
export function validateSenderRule(owner: string, sender: string, rule: SenderRule): string | null {
  if (rule === "block" && sender === owner) {
    return "You cannot block your own address.";
  }
  return null;
}
