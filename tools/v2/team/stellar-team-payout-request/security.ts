/**
 * security.ts — hardening helpers for the Stellar Team Payout Request tool (#667).
 *
 * Adds explicit handling for malformed / hostile input and guards against
 * unnecessary work on large payout batches, per the issue acceptance criteria.
 * Self-contained: no network, no secrets, no main-app linkage. All work stays
 * inside `tools/v2/team/stellar-team-payout-request/`.
 *
 * Unsafe inputs addressed:
 *  - Negative / non-finite / excessive amounts (math abuse, overflow)
 *  - Malformed Stellar addresses (lookup/transfer targeting abuse)
 *  - Oversized recipient lists (batch amplification / gas/ops DoS)
 *  - Hostile memo text (control bytes, oversized Stellar memo)
 *  - Missing idempotency key (duplicate-execution risk)
 */

/** Hard limits derived from threat assumptions (see docs/SECURITY.md). */
export const MAX_RECIPIENTS = 100;
export const MAX_MEMO_CHARS = 28; // Stellar memo_text byte limit
export const MAX_PAYOUT_AMOUNT = 1e15; // stroops upper bound guard
export const MIN_PAYOUT_AMOUNT = 0; // strictly positive required

/**
 * Stellar accounts are 56-char Ed25519 base32 (G...) addresses. This is a
 * structural check only (not a checksum verify); sufficient to reject obviously
 * hostile/garbage targets before any downstream call.
 */
const STELLAR_ADDRESS_RE = /^G[ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]{55}$/;

/** Strip control characters (keeps TAB/LF/CR) and clamp length. */
function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (isControl) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

export type PayoutRecipient = {
  address: string;
  amount: number;
};

export type PayoutRequest = {
  source: string;
  memo?: string;
  recipients: PayoutRecipient[];
  idempotencyKey: string;
};

export type SecurityIssue = { field: string; message: string };

export type SanitizeResult = {
  value: PayoutRequest;
  issues: SecurityIssue[];
};

/**
 * Validate + sanitize a payout request. Returns a sanitized request plus any
 * blocking issues. Callers must refuse to execute when `issues.length > 0`.
 */
export function hardenPayoutRequest(input: PayoutRequest): SanitizeResult {
  const issues: SecurityIssue[] = [];

  if (typeof input.source !== "string" || !STELLAR_ADDRESS_RE.test(input.source)) {
    issues.push({ field: "source", message: "source is not a valid Stellar address" });
  }

  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
    issues.push({ field: "idempotencyKey", message: "idempotencyKey is required" });
  }

  if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
    issues.push({ field: "recipients", message: "at least one recipient is required" });
  }
  if (input.recipients && input.recipients.length > MAX_RECIPIENTS) {
    issues.push({
      field: "recipients",
      message: `too many recipients (max ${MAX_RECIPIENTS})`,
    });
  }

  const recipients = (input.recipients ?? []).map((r, idx) => {
    const field = `recipients[${idx}]`;
    if (typeof r.address !== "string" || !STELLAR_ADDRESS_RE.test(r.address)) {
      issues.push({ field, message: "invalid recipient address" });
    }
    if (
      typeof r.amount !== "number" ||
      !Number.isFinite(r.amount) ||
      r.amount <= MIN_PAYOUT_AMOUNT ||
      r.amount > MAX_PAYOUT_AMOUNT
    ) {
      issues.push({ field, message: "amount must be a finite positive number within bounds" });
    }
    return { address: r.address, amount: r.amount };
  });

  const memo = input.memo === undefined ? undefined : stripControlChars(input.memo);
  if (memo !== undefined && memo.length > MAX_MEMO_CHARS) {
    issues.push({ field: "memo", message: `memo exceeds ${MAX_MEMO_CHARS} chars` });
  }

  return {
    value: {
      source: input.source,
      memo: memo === undefined ? undefined : memo.slice(0, MAX_MEMO_CHARS),
      recipients,
      idempotencyKey: (input.idempotencyKey ?? "").trim(),
    },
    issues,
  };
}

/**
 * Performance guard: bound a payout batch so a huge recipient list cannot
 * amplify downstream ops. Returns at most `MAX_RECIPIENTS` recipients (the
 * caller should already have rejected oversize lists via `hardenPayoutRequest`).
 */
export function capBatch(recipients: PayoutRecipient[]): PayoutRecipient[] {
  return recipients.slice(0, MAX_RECIPIENTS);
}

/** Sum of payout amounts; used to short-circuit obviously-oversized batches. */
export function totalAmount(recipients: PayoutRecipient[]): number {
  return recipients.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0);
}
