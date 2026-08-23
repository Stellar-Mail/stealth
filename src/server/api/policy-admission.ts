/**
 * Contract-faithful mailbox admission evaluation (Issue #1943 BETA-036).
 *
 * Mirrors `PoliciesContract::evaluate` in `contracts/soroban/policies/src/lib.rs`
 * so off-chain fallback and on-chain reads produce the same decision tree:
 * block, allow, verification, receipt, sender tier, unknown-sender default,
 * then mailbox minimum postage.
 *
 * The existing {@link evaluateMailboxPolicy} API evaluator is left unchanged
 * (it is the public `/policies/evaluate` contract). Relay admission uses this
 * module so a later policy change cannot be applied to a recorded decision —
 * callers persist the returned evidence, not a live re-query.
 */

import type {
  AdmissionDisposition,
  AdmissionEvidence,
  AdmissionReason,
  AdmissionSource,
  ChainMailboxPolicy,
  MailboxPolicy,
  SenderRule,
} from "./domain";
import { defaultMailboxPolicy } from "./repository";

export interface AdmissionPolicySnapshot {
  policy: ChainMailboxPolicy;
  version: number;
  rule: SenderRule;
  /** Sender-specific postage floor, when the chain (or a test double) has one. */
  tier: string | null;
}

export interface AdmissionInput {
  postage: string;
  verified: boolean;
  receipt: boolean;
}

export interface AdmissionDecision {
  allowed: boolean;
  reason: AdmissionReason;
  requiredPostage: string;
  rule: SenderRule;
  version: number;
}

const ZERO = 0n;

function asNonNegativeBigInt(value: string): bigint {
  try {
    const parsed = BigInt(value);
    return parsed < ZERO ? ZERO : parsed;
  } catch {
    return ZERO;
  }
}

/**
 * Maps a three-field API policy onto the four-field on-chain shape. Receipt
 * preference defaults off, matching {@link toChainMailboxPolicy}.
 */
export function toAdmissionPolicy(
  policy: MailboxPolicy,
  requireReceipt = false,
): ChainMailboxPolicy {
  return {
    allowUnknown: policy.allowUnknown,
    requireVerified: policy.requireVerified,
    requireReceipt,
    minimumPostage: policy.minimumPostage,
  };
}

export function defaultAdmissionPolicy(): ChainMailboxPolicy {
  return toAdmissionPolicy(defaultMailboxPolicy, false);
}

/**
 * Pure evaluate matching the Soroban Policies contract. Postage strings that
 * are not valid non-negative integers are treated as zero (the caller should
 * have already schema-validated live input).
 */
export function evaluateAdmissionDecision(
  snapshot: AdmissionPolicySnapshot,
  input: AdmissionInput,
): AdmissionDecision {
  const { policy, version, rule, tier } = snapshot;
  const postage = asNonNegativeBigInt(input.postage);
  const mailboxMinimum = asNonNegativeBigInt(policy.minimumPostage);
  const tierMinimum = tier === null ? null : asNonNegativeBigInt(tier);

  if (rule === "block") {
    return {
      allowed: false,
      reason: "sender_blocked",
      requiredPostage: mailboxMinimum.toString(),
      rule,
      version,
    };
  }
  if (rule === "allow") {
    return {
      allowed: true,
      reason: "sender_allowed",
      requiredPostage: "0",
      rule,
      version,
    };
  }

  const requiredPostage = (tierMinimum ?? mailboxMinimum).toString();
  const required = tierMinimum ?? mailboxMinimum;

  if (policy.requireVerified && !input.verified) {
    return {
      allowed: false,
      reason: "verification_required",
      requiredPostage,
      rule,
      version,
    };
  }
  if (policy.requireReceipt && !input.receipt) {
    return {
      allowed: false,
      reason: "receipt_required",
      requiredPostage,
      rule,
      version,
    };
  }
  if (tierMinimum !== null) {
    return {
      allowed: postage >= tierMinimum,
      reason: postage >= tierMinimum ? "tier_satisfied" : "insufficient_postage",
      requiredPostage: tierMinimum.toString(),
      rule,
      version,
    };
  }
  if (!policy.allowUnknown) {
    return {
      allowed: false,
      reason: "unknown_senders_disabled",
      requiredPostage,
      rule,
      version,
    };
  }
  return {
    allowed: postage >= required,
    reason: postage >= required ? "policy_satisfied" : "insufficient_postage",
    requiredPostage,
    rule,
    version,
  };
}

/**
 * Classifies the contract decision into the five sender-facing dispositions
 * the relay must enforce: trusted, request, verified, priced, blocked.
 */
export function admissionDisposition(
  decision: AdmissionDecision,
  policy: ChainMailboxPolicy,
): AdmissionDisposition {
  if (decision.reason === "sender_blocked" || decision.reason === "unknown_senders_disabled") {
    return "blocked";
  }
  if (decision.reason === "sender_allowed") {
    return "trusted";
  }
  if (decision.reason === "verification_required") {
    return "verified";
  }
  if (decision.reason === "insufficient_postage" || decision.reason === "tier_satisfied") {
    return "priced";
  }
  if (decision.reason === "receipt_required") {
    return "verified";
  }
  if (!decision.allowed) {
    return "blocked";
  }
  if (
    asNonNegativeBigInt(policy.minimumPostage) > ZERO ||
    asNonNegativeBigInt(decision.requiredPostage) > ZERO
  ) {
    return "priced";
  }
  if (policy.requireVerified) {
    return "verified";
  }
  return "request";
}

export function toAdmissionEvidence(
  decision: AdmissionDecision,
  policy: ChainMailboxPolicy,
  source: AdmissionSource,
  evaluatedAt: string,
): AdmissionEvidence {
  return {
    allowed: decision.allowed,
    disposition: admissionDisposition(decision, policy),
    reason: decision.reason,
    rule: decision.rule,
    policyVersion: decision.version,
    requiredPostage: decision.requiredPostage,
    source,
    evaluatedAt,
  };
}

/**
 * Chooses the policy snapshot to evaluate and the evidence source.
 *
 * - Chain version >= off-chain version: evaluate the chain snapshot (`chain`).
 * - Chain version < off-chain version: the ledger is behind a confirmed local
 *   write, so evaluate the current off-chain policy (`stale_chain_fallback`).
 * - Chain unavailable: evaluate the off-chain policy (`offchain`).
 */
export function selectAdmissionSnapshot(input: {
  offchain: AdmissionPolicySnapshot;
  chain: AdmissionPolicySnapshot | null;
}): { snapshot: AdmissionPolicySnapshot; source: AdmissionSource } {
  if (!input.chain) {
    return { snapshot: input.offchain, source: "offchain" };
  }
  if (input.chain.version < input.offchain.version) {
    return { snapshot: input.offchain, source: "stale_chain_fallback" };
  }
  return { snapshot: input.chain, source: "chain" };
}

export const ADMISSION_REASON_MESSAGES: Record<AdmissionReason, string> = {
  sender_allowed: "Sender is explicitly allowed by the recipient.",
  sender_blocked: "Sender is explicitly blocked by the recipient.",
  unknown_senders_disabled: "Recipient does not accept mail from unknown senders.",
  verification_required: "Recipient requires sender verification.",
  receipt_required: "Recipient requires a delivery receipt.",
  insufficient_postage: "Provided postage is insufficient for this recipient.",
  policy_satisfied: "Sender satisfies all recipient mailbox policies.",
  tier_satisfied: "Sender meets the recipient's sender-specific postage tier.",
};
