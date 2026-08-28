import { contract, Keypair } from "@stellar/stellar-sdk";
import type { BetaRuntimeConfig } from "../../config/schema";
import { lifecycle } from "../../services/stellar/contracts";
import type { LifecycleAnchor } from "./domain";
import { advanceToDeliveryState } from "./delivery-hooks";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

// ---------------------------------------------------------------------------
// BETA-043 (Issue #1950) — message lifecycle anchoring
//
// Anchors a message commitment on the on-chain Lifecycle contract. Only the
// message commitment (messageId) and non-secret envelope metadata (sender,
// recipient, amount, verified, receiptRequired) are ever passed to the
// contract — plaintext or private payload metadata never reach transaction
// arguments. Anchoring is idempotent per message commitment: the contract's
// DuplicateLifecycle is treated as a success and collapses onto the stored
// anchor. The signer is the configured operator/managed-wallet keypair; the
// durable intent + reconciliation flow mirrors BETA-023 policy writes.
// ---------------------------------------------------------------------------

export const MAX_LIFECYCLE_ANCHOR_ATTEMPTS = 3;

/** Envelope metadata carried into an anchor; durable bookkeeping fields are derived. */
export type LifecycleAnchorInput = Omit<
  LifecycleAnchor,
  "status" | "scheduledAt" | "updatedAt" | "failureCount" | "lastError" | "txHash"
>;

export type LifecycleAnchorOutcome =
  | { status: "confirmed"; txHash?: string }
  | { status: "duplicate" }
  | { status: "mismatch"; code: lifecycle.LifecycleError }
  | { status: "rejected"; code: lifecycle.LifecycleError }
  | { status: "retryable"; reason: "rpc_unavailable" | "confirmation_timeout" };

/**
 * The durable-intent → chain boundary. A stub can be injected in tests; the
 * Soroban adapter submits real transactions to the Lifecycle contract.
 */
export interface LifecycleChainAdapter {
  anchor(input: LifecycleAnchor): Promise<LifecycleAnchorOutcome>;
  getStatus(messageId: string): Promise<{ found: boolean }>;
}

// ---------------------------------------------------------------------------
// Error classification (mirrors the contract's error enum)
// ---------------------------------------------------------------------------

function extractLifecycleErrorCode(message: string): number | undefined {
  const match = /#(\d+)/.exec(message);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function classifyContractError(message: string): LifecycleAnchorOutcome {
  const code = extractLifecycleErrorCode(message);
  if (code === undefined) return { status: "retryable", reason: "rpc_unavailable" };
  const variant = lifecycle.parseLifecycleError(code);
  if (variant === undefined) return { status: "retryable", reason: "rpc_unavailable" };

  switch (variant) {
    case lifecycle.LifecycleError.DuplicateLifecycle:
      return { status: "duplicate" };
    case lifecycle.LifecycleError.PostageMismatch:
    case lifecycle.LifecycleError.ReceiptMismatch:
    case lifecycle.LifecycleError.PolicyRejected:
    case lifecycle.LifecycleError.PolicyVersionMismatch:
      return { status: "mismatch", code: variant };
    default:
      return { status: "rejected", code: variant };
  }
}

// ---------------------------------------------------------------------------
// Soroban adapter
// ---------------------------------------------------------------------------

export interface SorobanLifecycleChainAdapterOptions {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  operatorPublicKey: string;
  operatorSecret: string;
}

/**
 * Submits real Lifecycle contract transactions. The source account is the
 * operator keypair; per-sender auth entries are a follow-on when the delegated
 * signer lands, so an operator-anchored bind that requires the sender's auth
 * surfaces as a retryable outcome and exhausts the durable-intent attempts.
 */
export class SorobanLifecycleChainAdapter implements LifecycleChainAdapter {
  private readonly client: contract.Client;

  constructor(opts: SorobanLifecycleChainAdapterOptions) {
    this.client = lifecycle.createLifecycleClient({
      contractId: opts.contractId,
      networkPassphrase: opts.networkPassphrase,
      rpcUrl: opts.rpcUrl,
      publicKey: opts.operatorPublicKey,
      signer: opts.operatorSecret,
    });
  }

  async anchor(input: LifecycleAnchor): Promise<LifecycleAnchorOutcome> {
    const tx = await (this.client as any).bind({
      message_id: Buffer.from(input.messageId, "hex"),
      owner: input.recipient,
      sender: input.sender,
      recipient: input.recipient,
      amount: BigInt(input.amount),
      verified: input.verified,
      receipt_required: input.receiptRequired,
    });

    const simulated = tx.result as
      | contract.Ok<lifecycle.LifecycleRecord>
      | contract.Err<{ message: string }>;
    if (simulated.isErr()) {
      return classifyContractError(simulated.unwrapErr().message);
    }

    try {
      const sent = await tx.signAndSend();
      const result = sent.result as
        | contract.Ok<lifecycle.LifecycleRecord>
        | contract.Err<{ message: string }>;
      if (result.isErr()) {
        return classifyContractError(result.unwrapErr().message);
      }
      return { status: "confirmed", txHash: sent.sendTransactionResponse.hash };
    } catch (error) {
      if (error instanceof contract.SentTransaction.Errors.TransactionStillPending) {
        return { status: "retryable", reason: "confirmation_timeout" };
      }
      return { status: "retryable", reason: "rpc_unavailable" };
    }
  }

  async getStatus(messageId: string): Promise<{ found: boolean }> {
    const result = await lifecycle.get(this.client, Buffer.from(messageId, "hex"));
    if (result.isOk()) return { found: true };
    const code = extractLifecycleErrorCode(result.unwrapErr().message);
    if (code === lifecycle.LifecycleError.MissingLifecycle) return { found: false };
    throw new Error("Lifecycle status read failed");
  }
}

export function buildLifecycleChainAdapter(
  config: Pick<BetaRuntimeConfig, "network" | "contract" | "secrets">,
): LifecycleChainAdapter {
  const secret = config.secrets?.operatorSecret;
  if (!secret) {
    throw new ApiError(
      503,
      "dependency_unavailable",
      "No operator keypair is configured for lifecycle anchoring",
    );
  }
  const keypair = Keypair.fromSecret(secret);
  return new SorobanLifecycleChainAdapter({
    contractId: config.contract.lifecycleContractId,
    rpcUrl: config.network.sorobanRpcUrl,
    networkPassphrase: config.network.networkPassphrase,
    operatorPublicKey: keypair.publicKey(),
    operatorSecret: secret,
  });
}

// ---------------------------------------------------------------------------
// Durable schedule / read / reconcile (the "anchoring" half of BETA-043)
// ---------------------------------------------------------------------------

function anchorsEqual(left: LifecycleAnchor, right: LifecycleAnchorInput): boolean {
  return (
    left.sender === right.sender &&
    left.recipient === right.recipient &&
    left.amount === right.amount &&
    left.verified === right.verified &&
    left.receiptRequired === right.receiptRequired
  );
}

function sanitizeFailureReason(message: string): string {
  // Strip control characters and newlines (log-injection guard), then bound
  // the length. Only contract codes / sanitized reasons are ever passed.
  let cleaned = "";
  for (const char of message) {
    const code = char.charCodeAt(0);
    cleaned += code > 31 && code !== 127 ? char : " ";
  }
  return cleaned.trim().slice(0, 300);
}

/**
 * Records the durable intent to anchor a message commitment. Idempotent per
 * message commitment:
 * - The SAME details are a no-op and never reset a confirmed anchor.
 * - A previously failed anchor for the same details is re-armed as `pending`.
 * - Different details for an existing commitment conflict (409).
 */
export async function scheduleLifecycleAnchor(
  repository: ApiRepository,
  input: LifecycleAnchorInput,
  now = new Date(),
): Promise<LifecycleAnchor> {
  const iso = now.toISOString();
  const existing = await repository.getLifecycleAnchor(input.messageId);

  if (existing) {
    if (!anchorsEqual(existing, input)) {
      throw new ApiError(
        409,
        "conflict",
        "A lifecycle anchor already exists for this message with different details",
      );
    }
    if (existing.status === "failed") {
      return repository.setLifecycleAnchor({
        ...existing,
        status: "pending",
        updatedAt: iso,
        lastError: null,
      });
    }
    return existing;
  }

  const anchor: LifecycleAnchor = {
    messageId: input.messageId,
    sender: input.sender,
    recipient: input.recipient,
    amount: input.amount,
    verified: input.verified,
    receiptRequired: input.receiptRequired,
    status: "pending",
    scheduledAt: iso,
    updatedAt: iso,
    failureCount: 0,
    lastError: null,
    txHash: null,
  };
  return repository.setLifecycleAnchor(anchor);
}

export async function getLifecycleStatus(
  repository: ApiRepository,
  messageId: string,
): Promise<LifecycleAnchor> {
  const anchor = await repository.getLifecycleAnchor(messageId);
  if (!anchor) {
    throw new ApiError(404, "not_found", "Lifecycle anchor was not found");
  }
  return anchor;
}

/** Only the sender or the recipient may read an anchor's lifecycle status. */
export function assertLifecycleParticipant(
  anchor: Pick<LifecycleAnchor, "sender" | "recipient">,
  actor: string,
): void {
  if (actor !== anchor.sender && actor !== anchor.recipient) {
    throw new ApiError(
      403,
      "forbidden",
      "Only message participants can read this lifecycle status",
    );
  }
}

/**
 * Anchors a scheduled commitment through the chain adapter and advances the
 * durable record. Idempotent: an already-confirmed anchor is returned as-is.
 */
export async function anchorLifecycle(
  repository: ApiRepository,
  adapter: LifecycleChainAdapter,
  messageId: string,
  now = new Date(),
): Promise<LifecycleAnchor> {
  const existing = await repository.getLifecycleAnchor(messageId);
  if (!existing) {
    throw new ApiError(404, "not_found", "Lifecycle anchor was not found");
  }
  if (existing.status === "confirmed") return existing;

  const outcome = await adapter.anchor(existing);
  const iso = now.toISOString();

  switch (outcome.status) {
    case "confirmed":
    case "duplicate": {
      const anchored = await repository.setLifecycleAnchor({
        ...existing,
        status: "confirmed",
        updatedAt: iso,
        txHash: outcome.status === "confirmed" ? (outcome.txHash ?? null) : existing.txHash,
        lastError: null,
      });
      const chainReference =
        outcome.status === "confirmed" ? (outcome.txHash ?? null) : (anchored.txHash ?? null);
      await advanceToDeliveryState(
        repository,
        messageId,
        "anchored",
        existing.sender,
        "Lifecycle commitment anchored on-chain",
        chainReference,
        now,
      );
      return anchored;
    }
    case "mismatch":
    case "rejected":
      return repository.setLifecycleAnchor({
        ...existing,
        status: "failed",
        updatedAt: iso,
        failureCount: existing.failureCount + 1,
        lastError: sanitizeFailureReason(`lifecycle_anchor_${outcome.status}:${outcome.code}`),
      });
    case "retryable": {
      const failureCount = existing.failureCount + 1;
      if (failureCount >= MAX_LIFECYCLE_ANCHOR_ATTEMPTS) {
        return repository.setLifecycleAnchor({
          ...existing,
          status: "failed",
          updatedAt: iso,
          failureCount,
          lastError: sanitizeFailureReason(`lifecycle_anchor_retryable:${outcome.reason}`),
        });
      }
      return repository.setLifecycleAnchor({
        ...existing,
        status: "submitted",
        updatedAt: iso,
        failureCount,
        lastError: sanitizeFailureReason(`lifecycle_anchor_retryable:${outcome.reason}`),
      });
    }
  }
}

/**
 * Confirms a durable anchor against chain state. A record that is already
 * confirmed is returned as-is; a missing on-chain record leaves the durable
 * anchor unchanged (still pending) so the write can be retried.
 */
export async function reconcileLifecycleStatus(
  repository: ApiRepository,
  adapter: LifecycleChainAdapter,
  messageId: string,
  now = new Date(),
): Promise<LifecycleAnchor> {
  const existing = await repository.getLifecycleAnchor(messageId);
  if (!existing) {
    throw new ApiError(404, "not_found", "Lifecycle anchor was not found");
  }
  if (existing.status === "confirmed") return existing;

  const chain = await adapter.getStatus(messageId);
  if (!chain.found) return existing;

  const reconciled = await repository.setLifecycleAnchor({
    ...existing,
    status: "confirmed",
    updatedAt: now.toISOString(),
    lastError: null,
  });
  await advanceToDeliveryState(
    repository,
    messageId,
    "anchored",
    existing.sender,
    "Lifecycle commitment confirmed on-chain",
    reconciled.txHash ?? null,
    now,
  );
  return reconciled;
}
