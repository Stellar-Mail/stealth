import type {
  SenderRule,
  SenderRuleAction,
  SenderRuleRecord,
  SenderRuleChainStatus,
  ChainSenderRule,
} from "./domain";
import type { ApiRepository } from "./repository";
import { ApiError } from "./errors";
import { recordAuditEvent } from "./audit";

// ---------------------------------------------------------------------------
// BETA-037 (Issue #1944) — Live, versioned sender rules
//
// Sender rules (allow / block / verify / price) are persisted server-side,
// versioned, reconciled against the Policies contract on testnet, and enforced
// during relay admission. Every state-changing operation is idempotent and
// emits a structured audit event.
// ---------------------------------------------------------------------------

export interface SenderRuleServiceResult {
  owner: string;
  sender: string;
  rule: SenderRuleRecord;
  /** When the operation created a new rule (true) vs updated (false). */
  created: boolean;
}

export interface SenderRuleListResult {
  records: SenderRuleRecord[];
  nextCursor?: string;
}

export interface SenderRuleReconciliationResult {
  owner: string;
  sender: string;
  local: SenderRuleRecord | null;
  chain: ChainSenderRule | null;
  state: "synced" | "pending" | "drift" | "not_found";
}

/**
 * Creates a new versioned sender rule or updates an existing one.
 *
 * Idempotency: When `idempotencyKey` matches an existing record with the
 * same rule type and payload, the operation returns the existing record
 * without bumping the version (write-once semantic).
 *
 * Optimistic concurrency: When `version` is supplied it must match the
 * current record version; a mismatch returns 409 conflict.
 *
 * Owner authorization is NOT enforced here — callers MUST verify the actor
 * matches the owner before invoking (the route layer handles this).
 */
export async function createOrUpdateSenderRule(
  repository: ApiRepository,
  owner: string,
  sender: string,
  input: {
    rule: SenderRuleAction;
    pricePayload?: { minimumPostage: string };
    version?: number;
    idempotencyKey?: string;
  },
  now = new Date(),
): Promise<SenderRuleServiceResult> {
  const iso = now.toISOString();
  const existing = await repository.getSenderRuleRecord(owner, sender);

  // --- Validate price rule requires pricePayload ---
  if (input.rule === "price" && (!input.pricePayload || !input.pricePayload.minimumPostage)) {
    throw new ApiError(
      422,
      "validation_error",
      "pricePayload.minimumPostage is required when rule is 'price'",
    );
  }

  // --- Idempotency: same idempotency key → no-op ---
  if (existing) {
    if (input.idempotencyKey && existing.idempotencyKey === input.idempotencyKey) {
      return { owner, sender, rule: existing, created: false };
    }
    // Same rule+payload without version AND without a different idempotency key → no-op
    if (
      !input.version &&
      !input.idempotencyKey &&
      existing.rule === input.rule &&
      existing.pricePayload?.minimumPostage === input.pricePayload?.minimumPostage
    ) {
      return { owner, sender, rule: existing, created: false };
    }
  }

  // --- Optimistic concurrency check ---
  if (input.version !== undefined) {
    if (!existing) {
      throw new ApiError(
        409,
        "conflict",
        "Sender rule does not exist; cannot update with version",
        { details: { suppliedVersion: input.version } },
      );
    }
    if (existing.version !== input.version) {
      throw new ApiError(
        409,
        "conflict",
        "Sender rule has been modified since you last loaded it",
        {
          details: { currentVersion: existing.version, suppliedVersion: input.version },
        },
      );
    }
  } else if (existing) {
    // No version supplied and rule exists — reject to prevent silent overwrite
    throw new ApiError(409, "conflict", "Sender rule already exists; supply a version to update", {
      details: { currentVersion: existing.version },
    });
  }

  const version = existing ? existing.version + 1 : 1;

  const record: SenderRuleRecord = {
    owner,
    sender,
    rule: input.rule,
    pricePayload: input.rule === "price" ? input.pricePayload : undefined,
    version,
    chainStatus: "pending",
    scheduledAt: iso,
    updatedAt: iso,
    confirmedAt: null,
    failureCount: 0,
    lastError: null,
    txHash: null,
    idempotencyKey: input.idempotencyKey,
  };

  const saved = await repository.setSenderRuleRecord(record);

  // Mirror into the legacy sender rule map so evaluateMailboxPolicy sees it
  await repository.setSenderRule(owner, sender, input.rule as SenderRule);

  recordAuditEvent({
    actor: owner,
    action: existing ? "sender_rule.update" : "sender_rule.create",
    targetType: "sender_rule",
    safeTargetReference: `sender_rule:${owner}:${sender}:${input.rule}:v${version}`,
    result: "success",
    requestId: "",
  });

  return { owner, sender, rule: saved, created: !existing };
}

/**
 * Soft-deletes a sender rule by resetting it to "default". The deletion
 * is idempotent: deleting a non-existent or already-default rule is a no-op.
 */
export async function deleteSenderRule(
  repository: ApiRepository,
  owner: string,
  sender: string,
  now = new Date(),
): Promise<{ owner: string; sender: string; deleted: boolean }> {
  const existing = await repository.getSenderRuleRecord(owner, sender);
  if (!existing) {
    return { owner, sender, deleted: false };
  }

  const iso = now.toISOString();
  const deleted = await repository.deleteSenderRuleRecord(owner, sender);
  await repository.setSenderRule(owner, sender, "default");

  if (deleted) {
    recordAuditEvent({
      actor: owner,
      action: "sender_rule.delete",
      targetType: "sender_rule",
      safeTargetReference: `sender_rule:${owner}:${sender}:deleted:v${existing.version}`,
      result: "success",
      requestId: "",
    });
  }

  return { owner, sender, deleted };
}

/**
 * Lists all versioned sender rules for an owner, with cursor-based pagination.
 */
export async function listSenderRules(
  repository: ApiRepository,
  owner: string,
  options?: { limit?: number; after?: string },
): Promise<SenderRuleListResult> {
  return repository.listSenderRuleRecords(owner, options);
}

/**
 * Gets a single versioned sender rule record.
 */
export async function getSenderRuleRecord(
  repository: ApiRepository,
  owner: string,
  sender: string,
): Promise<SenderRuleRecord | null> {
  return repository.getSenderRuleRecord(owner, sender);
}

// ---------------------------------------------------------------------------
// Chain status transitions
// ---------------------------------------------------------------------------

/**
 * Transitions a sender rule's chain status. Called by the managed-wallet
 * signer after signing/submitting a testnet transaction and by the
 * reconciliation loop after polling for confirmation.
 *
 * Allowed transitions:
 *   pending   → submitted (signed and submitted to testnet)
 *   pending   → failed    (signing or submission error)
 *   submitted → confirmed (chain confirmed the write)
 *   submitted → failed    (chain rejected or timed out)
 *   failed    → pending   (retry scheduled)
 *   drift     → pending   (re-sync scheduled)
 */
const ALLOWED_CHAIN_TRANSITIONS: Record<SenderRuleChainStatus, Set<SenderRuleChainStatus>> = {
  pending: new Set(["submitted", "failed"]),
  submitted: new Set(["confirmed", "failed"]),
  confirmed: new Set(["drift"]),
  failed: new Set(["pending"]),
  drift: new Set(["pending"]),
};

export async function transitionSenderRuleChainStatus(
  repository: ApiRepository,
  owner: string,
  sender: string,
  nextStatus: SenderRuleChainStatus,
  meta: { txHash?: string; lastError?: string } = {},
  now = new Date(),
): Promise<SenderRuleRecord> {
  const record = await repository.getSenderRuleRecord(owner, sender);
  if (!record) {
    throw new ApiError(404, "not_found", "Sender rule record not found");
  }

  const allowed = ALLOWED_CHAIN_TRANSITIONS[record.chainStatus];
  if (!allowed?.has(nextStatus)) {
    throw new ApiError(
      409,
      "invalid_state_transition",
      `Cannot transition sender rule from '${record.chainStatus}' to '${nextStatus}'`,
      { fromState: record.chainStatus, toState: nextStatus },
    );
  }

  const iso = now.toISOString();
  const updated: SenderRuleRecord = {
    ...record,
    chainStatus: nextStatus,
    updatedAt: iso,
    txHash: meta.txHash ?? record.txHash,
    lastError: meta.lastError ? sanitizeFailureReason(meta.lastError) : record.lastError,
    confirmedAt: nextStatus === "confirmed" ? iso : record.confirmedAt,
    failureCount: nextStatus === "failed" ? record.failureCount + 1 : record.failureCount,
  };

  const saved = await repository.setSenderRuleRecord(updated);

  recordAuditEvent({
    actor: owner,
    action: `sender_rule.chain.${nextStatus}`,
    targetType: "sender_rule",
    safeTargetReference: `sender_rule:${owner}:${sender}:chain:${nextStatus}:v${record.version}`,
    result: nextStatus === "failed" ? "denied" : "success",
    requestId: "",
  });

  return saved;
}

/**
 * Retries a failed sender rule write by resetting it to "pending".
 * Idempotent: if the rule is already pending or confirmed, this is a no-op.
 */
export async function retrySenderRuleWrite(
  repository: ApiRepository,
  owner: string,
  sender: string,
  now = new Date(),
): Promise<SenderRuleRecord> {
  const record = await repository.getSenderRuleRecord(owner, sender);
  if (!record) {
    throw new ApiError(404, "not_found", "Sender rule record not found");
  }

  if (record.chainStatus === "confirmed") {
    return record; // already confirmed, no-op
  }

  if (record.chainStatus === "pending" || record.chainStatus === "submitted") {
    return record; // already in-flight, no-op
  }

  return transitionSenderRuleChainStatus(repository, owner, sender, "pending", {}, now);
}

// ---------------------------------------------------------------------------
// Chain reconciliation
// ---------------------------------------------------------------------------

/**
 * Compares the local sender rule against the chain state and updates the
 * chain status if they diverge. Returns the reconciliation result.
 */
export async function reconcileSenderRule(
  repository: ApiRepository,
  owner: string,
  sender: string,
  chain: ChainSenderRule | null,
  now = new Date(),
): Promise<SenderRuleReconciliationResult> {
  const local = await repository.getSenderRuleRecord(owner, sender);

  if (!local) {
    return {
      owner,
      sender,
      local: null,
      chain,
      state: chain ? "drift" : "not_found",
    };
  }

  if (!chain) {
    return {
      owner,
      sender,
      local,
      chain: null,
      state: local.chainStatus === "confirmed" ? "synced" : "pending",
    };
  }

  // Compare local vs chain
  const rulesMatch = local.rule === chain.rule;
  const priceMatch =
    local.rule === "price" ? local.pricePayload?.minimumPostage === chain.minimumPostage : true;

  if (rulesMatch && priceMatch && local.version <= chain.version) {
    // In sync or chain is ahead
    if (local.chainStatus !== "confirmed") {
      await transitionSenderRuleChainStatus(repository, owner, sender, "confirmed", {}, now);
      const refreshed = await repository.getSenderRuleRecord(owner, sender);
      return { owner, sender, local: refreshed!, chain, state: "synced" };
    }
    return { owner, sender, local, chain, state: "synced" };
  }

  // Divergence detected
  if (local.chainStatus !== "drift") {
    await transitionSenderRuleChainStatus(repository, owner, sender, "drift", {}, now);
    const refreshed = await repository.getSenderRuleRecord(owner, sender);
    return { owner, sender, local: refreshed!, chain, state: "drift" };
  }

  return { owner, sender, local, chain, state: "drift" };
}

// ---------------------------------------------------------------------------
// Relay admission integration
// ---------------------------------------------------------------------------

/**
 * Evaluates whether a sender is allowed under the current versioned rules
 * and mailbox policy. This extends the basic `evaluateMailboxPolicy` to
 * include "verify" and "price" rule types.
 *
 * The rule types affect relay admission as follows:
 *   allow  → always admitted
 *   block  → never admitted
 *   verify → admitted only if the sender is verified (same as requireVerified)
 *   price  → admitted only if postage ≥ pricePayload.minimumPostage
 *   default → falls through to the global mailbox policy
 */
export async function evaluateSenderRuleForAdmission(
  repository: ApiRepository,
  input: {
    owner: string;
    sender: string;
    postage: string;
    verified: boolean;
  },
): Promise<{
  allowed: boolean;
  reason: string;
  rule: SenderRuleRecord | null;
}> {
  const record = await repository.getSenderRuleRecord(input.owner, input.sender);
  if (!record) {
    // Fall through to default
    return { allowed: true, reason: "no_rule", rule: null };
  }

  switch (record.rule) {
    case "allow":
      return { allowed: true, reason: "sender_allowed", rule: record };
    case "block":
      return { allowed: false, reason: "sender_blocked", rule: record };
    case "verify":
      if (!input.verified) {
        return { allowed: false, reason: "verification_required", rule: record };
      }
      return { allowed: true, reason: "sender_verified", rule: record };
    case "price": {
      const minPostage = record.pricePayload?.minimumPostage ?? "0";
      if (BigInt(input.postage) < BigInt(minPostage)) {
        return { allowed: false, reason: "insufficient_postage", rule: record };
      }
      return { allowed: true, reason: "postage_sufficient", rule: record };
    }
    default:
      return { allowed: true, reason: "no_rule", rule: null };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFailureReason(message: string): string {
  let cleaned = "";
  for (const char of message) {
    const code = char.charCodeAt(0);
    cleaned += code > 31 && code !== 127 ? char : " ";
  }
  return cleaned.trim().slice(0, 300);
}
