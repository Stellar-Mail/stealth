import type {
  ChainMailboxPolicy,
  MailboxPolicy,
  PolicyWriteIntent,
  PolicyWriteStatus,
  SenderRule,
} from "./domain";
import type { ApiRepository } from "./repository";
import { defaultMailboxPolicy } from "./repository";
import { ApiError } from "./errors";

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

function apiPoliciesEqual(left: MailboxPolicy, right: MailboxPolicy): boolean {
  return (
    left.allowUnknown === right.allowUnknown &&
    left.requireVerified === right.requireVerified &&
    left.minimumPostage === right.minimumPostage
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
  options: { requireReceipt?: boolean; version?: number } = {},
) {
  if (options.version !== undefined) {
    const intent = await repository.getPolicyWriteIntent(owner);
    const currentVersion = intent?.offchainVersion ?? 0;
    if (options.version !== currentVersion) {
      throw new ApiError(409, "conflict", "Policy has been modified since you last loaded it", {
        details: { currentVersion, suppliedVersion: options.version },
      });
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
  };
}

export async function getSenderRule(repository: ApiRepository, owner: string, sender: string) {
  return {
    owner,
    rule: await repository.getSenderRule(owner, sender),
    sender,
  };
}

export async function setSenderRule(
  repository: ApiRepository,
  owner: string,
  sender: string,
  rule: SenderRule,
) {
  return {
    owner,
    rule: await repository.setSenderRule(owner, sender, rule),
    sender,
  };
}

export async function evaluateMailboxPolicy(
  repository: ApiRepository,
  input: {
    owner: string;
    postage: string;
    sender: string;
    verified: boolean;
  },
) {
  const rule = await repository.getSenderRule(input.owner, input.sender);
  const { policy, source } = await getMailboxPolicy(repository, input.owner);
  if (rule === "allow")
    return {
      allowed: true,
      policy,
      source,
      reason: "sender_allowed" as const,
      rule,
    };
  if (rule === "block")
    return {
      allowed: false,
      policy,
      source,
      reason: "sender_blocked" as const,
      rule,
    };

  if (!policy.allowUnknown) {
    return {
      allowed: false,
      policy,
      source,
      reason: "unknown_senders_disabled" as const,
      rule,
    };
  }
  if (policy.requireVerified && !input.verified) {
    return {
      allowed: false,
      policy,
      source,
      reason: "verification_required" as const,
      rule,
    };
  }
  if (BigInt(input.postage) < BigInt(policy.minimumPostage)) {
    return {
      allowed: false,
      policy,
      source,
      reason: "insufficient_postage" as const,
      rule,
    };
  }

  return {
    allowed: true,
    policy,
    source,
    reason: "policy_satisfied" as const,
    rule,
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
  const stored = await repository.getPolicy(owner);
  const intent = await repository.getPolicyWriteIntent(owner);
  const { policy, source } = await getMailboxPolicy(repository, owner);

  const chainPolicy = chain.policy ?? null;
  const chainVersion = chain.version ?? null;
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

  if (chainVersion > (offchainVersion ?? 0)) {
    return { ...base, state: "chain_ahead" as const };
  }
  if (chainVersion < (offchainVersion ?? 0)) {
    return { ...base, state: "pending_write" as const };
  }

  if (chainPolicy && !apiPoliciesEqual(chainPolicy, policy)) {
    return { ...base, state: "diverged" as const };
  }
  return { ...base, state: "synced" as const };
}
