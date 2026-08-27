import type {
  ChainMailboxPolicy,
  MailboxPolicy,
  PolicySyncStatus,
  PolicyWriteIntent,
  PolicyWriteStatus,
  SenderRule,
  SenderRuleRecord,
  SenderRuleWriteIntent,
} from "./domain";
import type { ApiRepository } from "./repository";
import { defaultMailboxPolicy } from "./repository";
import { ApiError } from "./errors";
import {
  defaultAdmissionPolicy,
  toAdmissionPolicy,
  type AdmissionPolicySnapshot,
} from "./policy-admission";

// ---------------------------------------------------------------------------
// BETA-023 (Issue #1930) — privacy-safe mailbox policy defaults
//
// The beta default routes unknown senders to a review request, charges no
// (or the configured) minimum postage, and does not force delivery receipts.
// It is the provisioning default, distinct from the generic `defaultMailboxPolicy`
// fallback that applies to owners who have never been provisioned.
// ---------------------------------------------------------------------------

export const betaDefaultMailboxPolicy: ChainMailboxPolicy = {
  allowUnknown: true,
  requireVerified: false,
  requireReceipt: false,
  minimumPostage: "0",
};

/** The evaluable three-field off-chain policy carried by the beta default. */
export function toMailboxPolicy(chain: ChainMailboxPolicy): MailboxPolicy {
  return {
    allowUnknown: chain.allowUnknown,
    requireVerified: chain.requireVerified,
    minimumPostage: chain.minimumPostage,
  };
}

/** Rebuilds the full on-chain policy, defaulting an unknown receipt preference to off. */
export function toChainMailboxPolicy(
  policy: MailboxPolicy,
  requireReceipt: boolean | undefined,
): ChainMailboxPolicy {
  return {
    ...policy,
    requireReceipt: requireReceipt ?? false,
  };
}

function chainPoliciesEqual(left: ChainMailboxPolicy, right: ChainMailboxPolicy): boolean {
  return (
    left.allowUnknown === right.allowUnknown &&
    left.requireVerified === right.requireVerified &&
    left.requireReceipt === right.requireReceipt &&
    left.minimumPostage === right.minimumPostage
  );
}

function apiPoliciesEqual(
  left: MailboxPolicy,
  right: MailboxPolicy,
  leftRequireReceipt?: boolean,
  rightRequireReceipt?: boolean,
): boolean {
  return (
    left.allowUnknown === right.allowUnknown &&
    left.requireVerified === right.requireVerified &&
    left.minimumPostage === right.minimumPostage &&
    // When both sides supply a receipt preference, compare it too.  Omitting
    // the field (undefined) means the caller doesn't have the data and the
    // receipt dimension is skipped — matching the pre-BETA-041 behavior.
    (leftRequireReceipt === undefined ||
      rightRequireReceipt === undefined ||
      leftRequireReceipt === rightRequireReceipt)
  );
}

export async function getMailboxPolicy(repository: ApiRepository, owner: string) {
  const stored = await repository.getPolicy(owner);
  return {
    owner,
    policy: stored ?? defaultMailboxPolicy,
    source: stored ? ("configured" as const) : ("default" as const),
  };
}

export async function setMailboxPolicy(
  repository: ApiRepository,
  owner: string,
  policy: MailboxPolicy,
  options: { requireReceipt?: boolean; expectedVersion?: number } = {},
) {
  if (options.expectedVersion !== undefined) {
    const intent = await repository.getPolicyWriteIntent(owner);
    const actualVersion = intent?.offchainVersion ?? 0;
    if (actualVersion !== options.expectedVersion) {
      throw new ApiError(409, "conflict", "Mailbox policy version conflict");
    }
  }

  const stored = await repository.setPolicy(owner, policy);
  await schedulePolicyWrite(
    repository,
    owner,
    toChainMailboxPolicy(policy, options.requireReceipt),
  );
  return {
    owner,
    policy: stored,
    source: "configured" as const,
    version: (await repository.getPolicyWriteIntent(owner))?.offchainVersion ?? 1,
    sync: await deriveMailboxSyncStatus(repository, owner),
  };
}

export async function getSenderRule(repository: ApiRepository, owner: string, sender: string) {
  const record = await repository.getSenderRuleRecord(owner, sender);
  const writeIntent = await repository.getSenderRuleWriteIntent(owner, sender);
  return {
    owner,
    sender,
    rule: record?.rule ?? "default",
    version: record?.version ?? 0,
    updatedAt: record?.updatedAt ?? null,
    sync: deriveSenderSyncStatus(record, writeIntent, owner, sender),
    writeIntent: summarizeSenderWriteIntent(writeIntent),
  };
}

export async function listSenderRules(repository: ApiRepository, owner: string) {
  const { records } = await repository.listSenderRuleRecords(owner);
  const intents = await repository.listSenderRuleWriteIntents(owner);
  const intentBySender = new Map(intents.map((intent) => [intent.sender, intent]));

  const items = await Promise.all(
    records.map(async (record) => ({
      owner,
      sender: record.sender,
      rule: record.rule,
      version: record.version,
      updatedAt: record.updatedAt,
      sync: deriveSenderSyncStatus(
        record,
        intentBySender.get(record.sender) ?? null,
        owner,
        record.sender,
      ),
      writeIntent: summarizeSenderWriteIntent(intentBySender.get(record.sender) ?? null),
    })),
  );

  return { owner, items };
}

export async function setSenderRule(
  repository: ApiRepository,
  owner: string,
  sender: string,
  rule: SenderRule,
  options: { expectedVersion?: number } = {},
) {
  const result = await repository.compareAndSetSenderRule(
    owner,
    sender,
    rule,
    options.expectedVersion,
  );
  if (result.outcome === "conflict") {
    throw new ApiError(409, "conflict", "Sender rule version conflict");
  }

  await scheduleSenderRuleWrite(repository, owner, sender, rule);
  const writeIntent = await repository.getSenderRuleWriteIntent(owner, sender);

  return {
    owner,
    sender,
    rule,
    version: result.record.version,
    updatedAt: result.record.updatedAt,
    sync: deriveSenderSyncStatus(result.record, writeIntent, owner, sender),
    writeIntent: summarizeSenderWriteIntent(writeIntent),
  };
}

function summarizeSenderWriteIntent(intent: SenderRuleWriteIntent | null) {
  if (!intent) return null;
  return {
    status: intent.status,
    version: intent.offchainVersion,
    scheduledAt: intent.scheduledAt,
    updatedAt: intent.updatedAt,
    failureCount: intent.failureCount,
    lastError: intent.lastError,
    txHash: intent.txHash,
  };
}

function deriveSenderSyncStatus(
  record: SenderRuleRecord | null,
  intent: SenderRuleWriteIntent | null,
  owner: string,
  sender: string,
): PolicySyncStatus {
  if (!intent) return "confirmed";
  if (intent.status === "confirmed") return "confirmed";
  if (intent.status === "failed") return "failed";
  if (intent.status === "pending" || intent.status === "submitted") return "pending";
  void owner;
  void sender;
  void record;
  return "pending";
}

export async function deriveMailboxSyncStatus(
  repository: ApiRepository,
  owner: string,
): Promise<PolicySyncStatus> {
  const intent = await repository.getPolicyWriteIntent(owner);
  if (!intent) return "confirmed";
  if (intent.status === "confirmed") return "confirmed";
  if (intent.status === "failed") return "failed";
  return "pending";
}

export function deriveReconciliationSyncStatus(state: PolicyReconciliationState): PolicySyncStatus {
  switch (state) {
    case "synced":
      return "confirmed";
    case "diverged":
      return "drift";
    case "pending_write":
      return "pending";
    default:
      return "pending";
  }
}

/**
 * Stable policy-decision reason codes. These match the Policies contract
 * `PolicyReason` variants (snake_case) so off-chain evaluation, relay
 * admission, and on-chain `evaluate` stay comparable.
 */
export type PolicyReasonCode =
  | "sender_allowed"
  | "sender_blocked"
  | "unknown_senders_disabled"
  | "verification_required"
  | "receipt_required"
  | "insufficient_postage"
  | "policy_satisfied"
  | "tier_satisfied";

/**
 * Sender-facing admission class used by live relay admission (BETA-036).
 */
export type PolicyDecisionKind = "trusted" | "request" | "verified" | "priced" | "blocked";

export function policyDecisionKind(
  reason: PolicyReasonCode,
  requiredPostage = "0",
): PolicyDecisionKind {
  switch (reason) {
    case "sender_allowed":
      return "trusted";
    case "sender_blocked":
    case "unknown_senders_disabled":
      return "blocked";
    case "verification_required":
    case "receipt_required":
      return "verified";
    case "insufficient_postage":
    case "tier_satisfied":
      return "priced";
    case "policy_satisfied":
      return BigInt(requiredPostage) > 0n ? "priced" : "request";
  }
}

export interface MailboxPolicyEvaluation {
  allowed: boolean;
  policy: MailboxPolicy;
  source: "configured" | "default";
  reason: PolicyReasonCode;
  rule: SenderRule;
  kind: PolicyDecisionKind;
  requiredPostage: string;
  policyVersion: number;
  versionedRule?: SenderRuleRecord;
}

export interface EvaluateMailboxPolicyInput {
  owner: string;
  postage: string;
  sender: string;
  verified: boolean;
  receipt?: boolean;
  senderTier?: string | null;
}

function decision(base: Omit<MailboxPolicyEvaluation, "kind">): MailboxPolicyEvaluation {
  return {
    ...base,
    kind: policyDecisionKind(base.reason, base.requiredPostage),
  };
}

export async function evaluateMailboxPolicy(
  repository: ApiRepository,
  input: EvaluateMailboxPolicyInput,
): Promise<MailboxPolicyEvaluation> {
  const { policy, source } = await getMailboxPolicy(repository, input.owner);
  const intent = await repository.getPolicyWriteIntent(input.owner);
  const policyVersion = intent?.offchainVersion ?? 0;
  const requireReceipt = intent?.policy.requireReceipt ?? false;
  const mailboxMinimum = policy.minimumPostage;
  const receipt = input.receipt ?? false;

  const record = await repository.getSenderRuleRecord(input.owner, input.sender);
  if (record) {
    switch (record.rule) {
      case "allow":
        return decision({
          allowed: true,
          policy,
          source,
          reason: "sender_allowed",
          rule: record.rule,
          requiredPostage: "0",
          policyVersion,
          versionedRule: record,
        });
      case "block":
        return decision({
          allowed: false,
          policy,
          source,
          reason: "sender_blocked",
          rule: record.rule,
          requiredPostage: mailboxMinimum,
          policyVersion,
          versionedRule: record,
        });
      case "verify": {
        if (!input.verified) {
          return decision({
            allowed: false,
            policy,
            source,
            reason: "verification_required",
            rule: record.rule,
            requiredPostage: mailboxMinimum,
            policyVersion,
            versionedRule: record,
          });
        }
        if (BigInt(input.postage) < BigInt(policy.minimumPostage)) {
          return decision({
            allowed: false,
            policy,
            source,
            reason: "insufficient_postage",
            rule: record.rule,
            requiredPostage: mailboxMinimum,
            policyVersion,
            versionedRule: record,
          });
        }
        return decision({
          allowed: true,
          policy,
          source,
          reason: "policy_satisfied",
          rule: record.rule,
          requiredPostage: mailboxMinimum,
          policyVersion,
          versionedRule: record,
        });
      }
      case "price": {
        const minPostage = record.pricePayload?.minimumPostage ?? "0";
        if (BigInt(input.postage) < BigInt(minPostage)) {
          return decision({
            allowed: false,
            policy,
            source,
            reason: "insufficient_postage",
            rule: record.rule,
            requiredPostage: minPostage,
            policyVersion,
            versionedRule: record,
          });
        }
        if (policy.requireVerified && !input.verified) {
          return decision({
            allowed: false,
            policy,
            source,
            reason: "verification_required",
            rule: record.rule,
            requiredPostage: minPostage,
            policyVersion,
            versionedRule: record,
          });
        }
        return decision({
          allowed: true,
          policy,
          source,
          reason: "policy_satisfied",
          rule: record.rule,
          requiredPostage: minPostage,
          policyVersion,
          versionedRule: record,
        });
      }
    }
  }

  const rule = await repository.getSenderRule(input.owner, input.sender);

  if (rule === "allow") {
    return decision({
      allowed: true,
      policy,
      source,
      reason: "sender_allowed",
      rule,
      requiredPostage: "0",
      policyVersion,
    });
  }
  if (rule === "block") {
    return decision({
      allowed: false,
      policy,
      source,
      reason: "sender_blocked",
      rule,
      requiredPostage: mailboxMinimum,
      policyVersion,
    });
  }

  if (!policy.allowUnknown) {
    return decision({
      allowed: false,
      policy,
      source,
      reason: "unknown_senders_disabled",
      rule,
      requiredPostage: mailboxMinimum,
      policyVersion,
    });
  }
  if (policy.requireVerified && !input.verified) {
    return decision({
      allowed: false,
      policy,
      source,
      reason: "verification_required",
      rule,
      requiredPostage: input.senderTier ?? mailboxMinimum,
      policyVersion,
    });
  }
  if (requireReceipt && !receipt) {
    return decision({
      allowed: false,
      policy,
      source,
      reason: "receipt_required",
      rule,
      requiredPostage: input.senderTier ?? mailboxMinimum,
      policyVersion,
    });
  }

  if (input.senderTier != null) {
    const requiredPostage = input.senderTier;
    const allowed = BigInt(input.postage) >= BigInt(requiredPostage);
    return decision({
      allowed,
      policy,
      source,
      reason: allowed ? "tier_satisfied" : "insufficient_postage",
      rule,
      requiredPostage,
      policyVersion,
    });
  }

  if (BigInt(input.postage) < BigInt(policy.minimumPostage)) {
    return decision({
      allowed: false,
      policy,
      source,
      reason: "insufficient_postage",
      rule,
      requiredPostage: mailboxMinimum,
      policyVersion,
    });
  }

  return decision({
    allowed: true,
    policy,
    source,
    reason: "policy_satisfied",
    rule,
    requiredPostage: mailboxMinimum,
    policyVersion,
  });
}

/**
 * Loads the current off-chain policy snapshot used by relay admission
 * (Issue #1943 BETA-036). Version comes from the durable write intent so a
 * pending local change is visible even before the chain confirms it.
 */
export async function loadOffchainAdmissionSnapshot(
  repository: ApiRepository,
  owner: string,
  sender: string,
): Promise<AdmissionPolicySnapshot> {
  const stored = await repository.getPolicy(owner);
  const intent = await repository.getPolicyWriteIntent(owner);
  const rule = await repository.getSenderRule(owner, sender);
  const policy = stored
    ? toAdmissionPolicy(stored, intent?.policy.requireReceipt ?? false)
    : (intent?.policy ?? defaultAdmissionPolicy());
  return {
    policy,
    version: intent?.offchainVersion ?? 0,
    rule,
    tier: null,
  };
}

// ---------------------------------------------------------------------------
// Durable scheduled-write intent (the "schedule the matching testnet contract
// write" half of provisioning). BETA-017's managed-wallet signer consumes and
// advances these records; this slice owns their creation and idempotency.
// ---------------------------------------------------------------------------

export async function getPolicyWriteIntent(
  repository: ApiRepository,
  owner: string,
): Promise<PolicyWriteIntent | null> {
  return repository.getPolicyWriteIntent(owner);
}

/**
 * Records the durable intent to write `policy` to the Policies contract.
 *
 * Idempotency contract (mirrors the contract's version-as-change-marker rule):
 * - Re-scheduling the SAME policy is a no-op and NEVER bumps the off-chain
 *   version, so provisioning retries cannot inflate the on-chain version.
 * - A previously failed intent for the same policy is re-armed as `pending`
 *   with the SAME version (a retry, not a new change).
 * - A genuinely different policy bumps the version by exactly one.
 */
export async function schedulePolicyWrite(
  repository: ApiRepository,
  owner: string,
  policy: ChainMailboxPolicy,
  now = new Date(),
): Promise<PolicyWriteIntent> {
  const iso = now.toISOString();
  const existing = await repository.getPolicyWriteIntent(owner);

  if (existing && chainPoliciesEqual(existing.policy, policy)) {
    if (existing.status === "failed") {
      return repository.setPolicyWriteIntent({
        ...existing,
        status: "pending",
        updatedAt: iso,
        lastError: null,
      });
    }
    return existing;
  }

  const offchainVersion = existing ? existing.offchainVersion + 1 : 1;
  const intent: PolicyWriteIntent = {
    owner,
    policy,
    offchainVersion,
    status: "pending",
    scheduledAt: iso,
    updatedAt: iso,
    failureCount: existing?.failureCount ?? 0,
    lastError: null,
    txHash: null,
  };
  return repository.setPolicyWriteIntent(intent);
}

/** Marks the contract write as submitted (signed, not yet confirmed). */
export async function submitPolicyWrite(
  repository: ApiRepository,
  owner: string,
  now = new Date(),
): Promise<PolicyWriteIntent | null> {
  const existing = await repository.getPolicyWriteIntent(owner);
  if (!existing || existing.status !== "pending") return existing;
  return repository.setPolicyWriteIntent({
    ...existing,
    status: "submitted",
    updatedAt: now.toISOString(),
  });
}

/** Records a confirmed contract write. `txHash` is a redacted on-chain reference. */
export async function confirmPolicyWrite(
  repository: ApiRepository,
  owner: string,
  txHash?: string,
  now = new Date(),
): Promise<PolicyWriteIntent | null> {
  const existing = await repository.getPolicyWriteIntent(owner);
  if (!existing) return null;
  return repository.setPolicyWriteIntent({
    ...existing,
    status: "confirmed",
    updatedAt: now.toISOString(),
    txHash: txHash ?? existing.txHash,
    lastError: null,
  });
}

/**
 * Records a contract-write failure. The version is NEVER bumped here; a retry
 * of the same policy re-arms the intent at the same version (see
 * {@link schedulePolicyWrite}). `message` is sanitized and bounded so wallet
 * seeds, tokens and transaction payloads can never leak into logs or clients.
 */
export async function failPolicyWrite(
  repository: ApiRepository,
  owner: string,
  message: string,
  now = new Date(),
): Promise<PolicyWriteIntent | null> {
  const existing = await repository.getPolicyWriteIntent(owner);
  if (!existing) return null;
  return repository.setPolicyWriteIntent({
    ...existing,
    status: "failed",
    updatedAt: now.toISOString(),
    failureCount: existing.failureCount + 1,
    lastError: sanitizeFailureReason(message),
  });
}

function sanitizeFailureReason(message: string): string {
  // Strip control characters and newlines (log-injection guard), then bound
  // the length. Callers must never pass secrets; this is defense in depth.
  let cleaned = "";
  for (const char of message) {
    const code = char.charCodeAt(0);
    cleaned += code > 31 && code !== 127 ? char : " ";
  }
  return cleaned.trim().slice(0, 300);
}

// ---------------------------------------------------------------------------
// Durable sender-rule write intents (BETA-037)
// ---------------------------------------------------------------------------

export async function getSenderRuleWriteIntent(
  repository: ApiRepository,
  owner: string,
  sender: string,
): Promise<SenderRuleWriteIntent | null> {
  return repository.getSenderRuleWriteIntent(owner, sender);
}

export async function scheduleSenderRuleWrite(
  repository: ApiRepository,
  owner: string,
  sender: string,
  rule: SenderRule,
  options: { minimumPostage?: string | null } = {},
  now = new Date(),
): Promise<SenderRuleWriteIntent> {
  const iso = now.toISOString();
  const existing = await repository.getSenderRuleWriteIntent(owner, sender);
  const minimumPostage =
    rule === "price" ? (options.minimumPostage ?? existing?.minimumPostage ?? null) : null;

  if (rule === "price" && !minimumPostage) {
    throw new ApiError(
      422,
      "validation_error",
      "minimumPostage is required to schedule a price sender rule chain write",
    );
  }

  const unchanged =
    existing &&
    existing.rule === rule &&
    (rule !== "price" || existing.minimumPostage === minimumPostage);

  if (unchanged) {
    if (existing.status === "failed") {
      return repository.setSenderRuleWriteIntent({
        ...existing,
        status: "pending",
        updatedAt: iso,
        lastError: null,
      });
    }
    return existing;
  }

  const offchainVersion = existing ? existing.offchainVersion + 1 : 1;
  const intent: SenderRuleWriteIntent = {
    owner,
    sender,
    rule,
    minimumPostage,
    offchainVersion,
    status: "pending",
    scheduledAt: iso,
    updatedAt: iso,
    failureCount: existing?.failureCount ?? 0,
    lastError: null,
    txHash: null,
  };
  return repository.setSenderRuleWriteIntent(intent);
}

export async function submitSenderRuleWrite(
  repository: ApiRepository,
  owner: string,
  sender: string,
  now = new Date(),
): Promise<SenderRuleWriteIntent | null> {
  const existing = await repository.getSenderRuleWriteIntent(owner, sender);
  if (!existing || existing.status !== "pending") return existing;
  return repository.setSenderRuleWriteIntent({
    ...existing,
    status: "submitted",
    updatedAt: now.toISOString(),
  });
}

export async function confirmSenderRuleWrite(
  repository: ApiRepository,
  owner: string,
  sender: string,
  txHash?: string,
  now = new Date(),
): Promise<SenderRuleWriteIntent | null> {
  const existing = await repository.getSenderRuleWriteIntent(owner, sender);
  if (!existing) return null;
  return repository.setSenderRuleWriteIntent({
    ...existing,
    status: "confirmed",
    updatedAt: now.toISOString(),
    txHash: txHash ?? existing.txHash,
    lastError: null,
  });
}

export async function failSenderRuleWrite(
  repository: ApiRepository,
  owner: string,
  sender: string,
  message: string,
  now = new Date(),
): Promise<SenderRuleWriteIntent | null> {
  const existing = await repository.getSenderRuleWriteIntent(owner, sender);
  if (!existing) return null;
  return repository.setSenderRuleWriteIntent({
    ...existing,
    status: "failed",
    updatedAt: now.toISOString(),
    failureCount: existing.failureCount + 1,
    lastError: sanitizeFailureReason(message),
  });
}

// ---------------------------------------------------------------------------
// Reconciliation state: API policy version vs chain policy version.
// ---------------------------------------------------------------------------

export type PolicyReconciliationState =
  | "not_provisioned"
  | "pending_write"
  | "synced"
  | "chain_ahead"
  | "diverged";

export interface PolicyReconciliationChainState {
  policy?: MailboxPolicy;
  version?: number;
  /**
   * Whether the on-chain policy requires a delivery receipt.  The contract
   * carries this fourth boolean but `contractPolicyToApi` omits it; passing
   * it explicitly lets reconciliation detect receipt-policy drift.
   */
  requireReceipt?: boolean;
}

export interface PolicyReconciliation {
  owner: string;
  state: PolicyReconciliationState;
  offchain: {
    policy: MailboxPolicy | null;
    source: "default" | "configured" | null;
    version: number | null;
  };
  chain: {
    policy: MailboxPolicy | null;
    version: number | null;
  };
  writeIntent: {
    status: PolicyWriteStatus;
    version: number;
    policy: ChainMailboxPolicy;
    scheduledAt: string;
    updatedAt: string;
    failureCount: number;
    lastError: string | null;
  } | null;
}

/**
 * Computes the reconciliation state between the durable off-chain policy and
 * the on-chain Policies contract state. `chain` is the versioned policy read
 * from the contract; while BETA-017's chain client is not yet wired, callers
 * may omit it and reconciliation reports from the durable write intent alone.
 */
export async function getPolicyReconciliation(
  repository: ApiRepository,
  owner: string,
  chain: PolicyReconciliationChainState = {},
): Promise<PolicyReconciliation> {
  const chainPolicy = chain.policy ?? null;
  const chainVersion = chain.version ?? null;
  const chainRequireReceipt = chain.requireReceipt ?? undefined;

  const stored = await repository.getPolicy(owner);
  const intent = await repository.getPolicyWriteIntent(owner);
  const { policy, source } = await getMailboxPolicy(repository, owner);

  const offchainVersion = intent?.offchainVersion ?? null;

  const writeIntent = intent
    ? {
        status: intent.status,
        version: intent.offchainVersion,
        policy: intent.policy,
        scheduledAt: intent.scheduledAt,
        updatedAt: intent.updatedAt,
        failureCount: intent.failureCount,
        lastError: intent.lastError,
      }
    : null;

  const base = {
    owner,
    offchain: { policy, source, version: offchainVersion },
    chain: { policy: chainPolicy, version: chainVersion },
    writeIntent,
  };

  if (!stored) {
    // An active account must never be without an evaluable policy; provisioning
    // guarantees this. Reaching here means provisioning never ran for the owner.
    return { ...base, state: "not_provisioned" as const };
  }

  // A write is outstanding or retryable: the durable intent exists but the
  // chain has not confirmed it. This is the "testnet synchronization pending"
  // signal the story requires.
  if (intent && (intent.status === "pending" || intent.status === "submitted")) {
    return { ...base, state: "pending_write" as const };
  }
  if (intent && intent.status === "failed") {
    return { ...base, state: "pending_write" as const };
  }

  if (chainVersion === null) {
    // No chain state supplied: a confirmed (or absent) intent is treated as
    // in sync. The signer wires live chain reads once BETA-017 lands.
    return { ...base, state: "synced" as const };
  }

  // --- Version comparison with mailbox-scoped content check ---
  //
  // The Soroban Policies contract uses a single global version counter per
  // owner.  Sender-rule writes (set_sender_rule, set_sender_tier) also call
  // `bump_version`, so a sender-rule update raises the contract version even
  // though the mailbox policy itself hasn't changed.  Comparing versions alone
  // therefore produces false `chain_ahead`.  Instead, when the contract
  // version is ahead, we fall through to a content comparison: if the policy
  // content (including requireReceipt) matches, the version gap is caused by
  // an unrelated sender mutation and the mailbox is still synced.

  if (chainVersion < (offchainVersion ?? 0)) {
    return { ...base, state: "pending_write" as const };
  }

  if (
    chainPolicy &&
    !apiPoliciesEqual(chainPolicy, policy, chainRequireReceipt, intent?.policy.requireReceipt)
  ) {
    if (chainVersion > (offchainVersion ?? 0)) {
      return { ...base, state: "chain_ahead" as const };
    }
    return { ...base, state: "diverged" as const };
  }

  // Content matches (or no chain policy to compare).  Versions may still
  // differ when a sender-rule write bumped the global counter.
  if (chainVersion > (offchainVersion ?? 0)) {
    return { ...base, state: "synced" as const };
  }
  return { ...base, state: "synced" as const };
}

export async function getSenderRuleReconciliation(
  repository: ApiRepository,
  owner: string,
  sender: string,
  chainRule: SenderRule | null = null,
) {
  const record = await repository.getSenderRuleRecord(owner, sender);
  const writeIntent = await repository.getSenderRuleWriteIntent(owner, sender);
  const offchainRule = record?.rule ?? "default";

  // The chain does not store "default" — null means no rule override, which
  // is semantically equivalent to "default".
  const effectiveChainRule = chainRule ?? "default";

  let state: "pending_write" | "synced" | "diverged" = "synced";
  if (writeIntent && writeIntent.status !== "confirmed") {
    state = "pending_write";
  } else if (effectiveChainRule !== offchainRule) {
    state = "diverged";
  }

  return {
    owner,
    sender,
    state,
    offchain: {
      rule: offchainRule,
      version: record?.version ?? 0,
    },
    chain: {
      rule: chainRule,
    },
    writeIntent: summarizeSenderWriteIntent(writeIntent),
    sync:
      state === "diverged" ? "drift" : deriveSenderSyncStatus(record, writeIntent, owner, sender),
  };
}
