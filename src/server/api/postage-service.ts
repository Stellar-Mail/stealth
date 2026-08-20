import { createHmac } from "node:crypto";
import type { Postage } from "./domain";
import { ApiError, type ApiErrorCode } from "./errors";
import {
  checkAccountLimit,
  checkDeviceLimit,
  checkIpLimit,
  checkRelayLimit,
  checkSenderRecipientLimit,
  type AbuseDecision,
} from "./abuse-service";
import { getMailboxPolicy } from "./policy-service";
import { RuntimePostageAssetProvider, type PostageAssetProvider } from "./postage-asset-service";
import * as metrics from "./metrics";
import type { ApiRepository } from "./repository";
import { recordAuditEvent } from "./audit";
import type { ApiContext } from "./context";

export type SubmitPostageContext = {
  actorId?: string;
  fingerprint?: string;
  ip?: string;
  relayId?: string;
  sender?: string;
};

function throwAbuseLimitError(
  decision: AbuseDecision,
  status: number,
  code: ApiErrorCode,
  message: string,
) {
  throw new ApiError(status, code, message, {
    ...(decision.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: decision.retryAfterSeconds }),
    ...(decision.outage === undefined
      ? {}
      : {
          outagePolicy: decision.outage.policy,
          outageRoute: decision.outage.route,
        }),
  });
}

function rejectLimitedPostage(
  decision: AbuseDecision,
  labels: Record<string, string>,
  limitMessage: string,
) {
  metrics.incrementCounter("postage_limit_rejected", labels);

  if (decision.outage) {
    throwAbuseLimitError(
      decision,
      503,
      "dependency_unavailable",
      `Abuse ${decision.outage.check} check is unavailable`,
    );
  }

  throwAbuseLimitError(decision, 429, "too_many_requests", limitMessage);
}

function SECRET() {
  return process.env.STEALTH_CURSOR_SECRET ?? "dev-secret";
}

/**
 * Canonical fields bound into a signed postage quote (BETA-039 / Issue #1946).
 *
 * Binding the message identity, the configured testnet asset, the recipient's
 * off-chain policy version and the network passphrase means a quote cannot be
 * replayed against another message or recipient, and expires or policy-stale
 * quotes fail deterministically on submission.
 */
export interface QuoteSignFields {
  recipient: string;
  sender: string;
  amount: string;
  messageId: string;
  asset: string;
  policyVersion: number;
  network: string;
  issuedAt: string;
  expiresAt: string;
}

export function signQuote(fields: QuoteSignFields): string {
  const secret = SECRET();
  if (!secret) {
    throw new ApiError(500, "internal_error", "Quote signing secret is not configured");
  }
  const payload = [
    fields.recipient,
    fields.sender,
    fields.messageId,
    fields.amount,
    fields.asset,
    String(fields.policyVersion),
    fields.network,
    fields.issuedAt,
    fields.expiresAt,
  ].join(":");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export type QuoteReason =
  "trusted_sender" | "mailbox_minimum" | "sender_blocked" | "insufficient_balance";

export interface PostageQuoteResult {
  amount: string;
  eligible: boolean;
  reason: QuoteReason;
  trusted: boolean;
  messageId: string;
  asset: string;
  policyVersion: number;
  network: string;
  fee: { bps: number; amount: string };
  balance: { available: string | null; sufficient: boolean | null };
  retryAfterSeconds: number;
  issuedAt: string;
  expiresAt: string;
  digest: string;
}

/** Mirrors the postage contract's `fee_for` (floor of amount * fee_bps / 10000). */
function feeFor(amount: string, feeBps: number): string {
  if (feeBps <= 0) return "0";
  try {
    return ((BigInt(amount) * BigInt(feeBps)) / 10_000n).toString();
  } catch {
    return "0";
  }
}

/**
 * The recipient's current off-chain policy version. The version is carried by
 * the durable scheduled-write intent; an owner who has never scheduled a write
 * is treated as version 0 (baseline), so a later policy change always bumps the
 * version and invalidates any earlier quote.
 */
async function getPolicyVersion(repository: ApiRepository, recipient: string): Promise<number> {
  const intent = await repository.getPolicyWriteIntent(recipient);
  return intent?.offchainVersion ?? 0;
}

function quoteLifetimeMs(): number {
  const configured = process.env.STEALTH_QUOTE_LIFETIME_MS;
  if (configured) {
    const parsed = parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 15 * 60 * 1000;
}

export async function quotePostage(
  context: ApiContext,
  input: { recipient: string; sender: string; messageId: string },
  options: { assetProvider?: PostageAssetProvider; now?: () => Date } = {},
): Promise<PostageQuoteResult> {
  try {
    const provider = options.assetProvider ?? new RuntimePostageAssetProvider();
    const [rule, assetInfo, { policy }] = await Promise.all([
      context.repository.getSenderRule(input.recipient, input.sender),
      provider.getAssetInfo(),
      getMailboxPolicy(context.repository, input.recipient),
    ]);

    const now = options.now ? options.now() : new Date();
    const issuedAt = now.toISOString();
    const lifetimeMs = quoteLifetimeMs();
    const expiresAt = new Date(now.getTime() + lifetimeMs).toISOString();

    const [policyVersion, balance] = await Promise.all([
      getPolicyVersion(context.repository, input.recipient),
      provider.getSenderBalance(input.sender),
    ]);

    const build = (
      partial: { amount: string; eligible: boolean; reason: QuoteReason; trusted: boolean },
      sufficient: boolean | null,
    ): PostageQuoteResult => ({
      amount: partial.amount,
      eligible: partial.eligible,
      reason: partial.reason,
      trusted: partial.trusted,
      messageId: input.messageId,
      asset: assetInfo.asset,
      policyVersion,
      network: assetInfo.network,
      fee: { bps: assetInfo.feeBps, amount: feeFor(partial.amount, assetInfo.feeBps) },
      balance: { available: balance.available, sufficient },
      retryAfterSeconds: Math.max(1, Math.floor(lifetimeMs / 1000)),
      issuedAt,
      expiresAt,
      digest: signQuote({
        recipient: input.recipient,
        sender: input.sender,
        messageId: input.messageId,
        amount: partial.amount,
        asset: assetInfo.asset,
        policyVersion,
        network: assetInfo.network,
        issuedAt,
        expiresAt,
      }),
    });

    if (rule === "block") {
      const result = build(
        {
          amount: policy.minimumPostage,
          eligible: false,
          reason: "sender_blocked",
          trusted: false,
        },
        false,
      );

      recordAuditEvent({
        actor: input.sender,
        action: "postage.quote",
        targetType: "mailbox",
        safeTargetReference: input.recipient,
        result: "success",
        requestId: context.requestId ?? "unknown",
      });
      return result;
    }

    const trusted = rule === "allow";
    const amount = trusted ? "0" : policy.minimumPostage;

    let sufficient: boolean | null = balance.sufficient;
    if (balance.available !== null) {
      try {
        sufficient = BigInt(balance.available) >= BigInt(amount);
      } catch {
        sufficient = false;
      }
    }

    let eligible = true;
    let reason: QuoteReason = trusted ? "trusted_sender" : "mailbox_minimum";
    if (sufficient === false) {
      eligible = false;
      reason = "insufficient_balance";
    }

    const result = build({ amount, eligible, reason, trusted }, sufficient);

    recordAuditEvent({
      actor: input.sender,
      action: "postage.quote",
      targetType: "mailbox",
      safeTargetReference: input.recipient,
      result: "success",
      requestId: context.requestId ?? "unknown",
    });
    return result;
  } catch (error) {
    recordAuditEvent({
      actor: input.sender,
      action: "postage.quote",
      targetType: "mailbox",
      safeTargetReference: input.recipient,
      result: "denied",
      requestId: context.requestId ?? "unknown",
    });
    throw error;
  }
}

export interface QuoteSubmissionInput {
  recipient: string;
  sender: string;
  amount: string;
  messageId: string;
  asset: string;
  policyVersion: number;
  network: string;
  issuedAt: string;
  expiresAt: string;
  quoteDigest: string;
}

/**
 * Deterministically validates an authenticated postage quote at submission time
 * (BETA-039 / Issue #1946). Every check is idempotent and order-independent:
 * the same inputs always produce the same outcome, and any substitution of the
 * message, recipient, amount, asset, policy version or network invalidates the
 * quote.
 */
export async function verifyQuoteSubmission(
  context: ApiContext,
  input: QuoteSubmissionInput,
  options: { assetProvider?: PostageAssetProvider; now?: () => Date } = {},
): Promise<void> {
  const now = options.now ? options.now() : new Date();

  if (new Date(input.expiresAt).getTime() <= now.getTime()) {
    throw new ApiError(422, "expired_challenge", "Quote has expired", {
      expiresAt: input.expiresAt,
      now: now.toISOString(),
    });
  }

  const provider = options.assetProvider ?? new RuntimePostageAssetProvider();
  const assetInfo = await provider.getAssetInfo();

  if (input.asset !== assetInfo.asset) {
    throw new ApiError(
      422,
      "invalid_quote",
      "Quote asset does not match the configured testnet asset",
      {
        expectedAsset: assetInfo.asset,
        suppliedAsset: input.asset,
      },
    );
  }

  if (input.network !== assetInfo.network) {
    throw new ApiError(422, "invalid_quote", "Quote network does not match the current network", {
      expectedNetwork: assetInfo.network,
      suppliedNetwork: input.network,
    });
  }

  const policyVersion = await getPolicyVersion(context.repository, input.recipient);
  if (input.policyVersion !== policyVersion) {
    throw new ApiError(422, "invalid_quote", "Quote is stale: the recipient policy has changed", {
      expectedPolicyVersion: policyVersion,
      suppliedPolicyVersion: input.policyVersion,
    });
  }

  const expectedDigest = signQuote({
    recipient: input.recipient,
    sender: input.sender,
    messageId: input.messageId,
    amount: input.amount,
    asset: input.asset,
    policyVersion: input.policyVersion,
    network: input.network,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  });
  if (expectedDigest !== input.quoteDigest) {
    throw new ApiError(422, "invalid_quote", "Quote digest is invalid or tampered");
  }
}

export async function submitPostage(
  context: ApiContext,
  input: Omit<Postage, "createdAt" | "status">,
  now = new Date(),
  submitContext: SubmitPostageContext = {},
) {
  try {
    const actorId = submitContext.actorId ?? "unknown";

    const accountLimit = await checkAccountLimit(context.repository, input.sender);
    if (!accountLimit.allowed) {
      rejectLimitedPostage(
        accountLimit,
        {
          actorId,
          limit: "account",
        },
        "Account limit exceeded",
      );
    }

    const ip = submitContext.ip ?? "unknown";
    const ipLimit = await checkIpLimit(context.repository, ip);
    if (!ipLimit.allowed) {
      rejectLimitedPostage(
        ipLimit,
        {
          ip,
          limit: "ip",
        },
        "IP limit exceeded",
      );
    }

    const fingerprint = submitContext.fingerprint ?? "";
    const deviceLimit = await checkDeviceLimit(context.repository, fingerprint);
    if (!deviceLimit.allowed) {
      rejectLimitedPostage(
        deviceLimit,
        {
          fingerprint: fingerprint || "unknown",
          limit: "device",
        },
        "Device limit exceeded",
      );
    }

    const senderRecipientLimit = await checkSenderRecipientLimit(
      context.repository,
      input.sender,
      input.recipient,
    );

    if (!senderRecipientLimit.allowed) {
      const sender = submitContext.sender ?? input.sender;

      rejectLimitedPostage(
        senderRecipientLimit,
        {
          limit: "sender_recipient",
          sender,
        },
        "Sender-recipient limit exceeded",
      );
    }

    const relayId = submitContext.relayId?.trim() || "unknown";
    const relayLimit = await checkRelayLimit(context.repository, relayId);

    if (!relayLimit.allowed) {
      rejectLimitedPostage(
        relayLimit,
        {
          limit: "relay",
          relayId,
        },
        "Relay limit exceeded",
      );
    }

    if (await context.repository.getPostage(input.messageId)) {
      throw new ApiError(409, "conflict", "Postage already exists for this message");
    }

    const rule = await context.repository.getSenderRule(input.recipient, input.sender);

    if (rule === "block") {
      throw new ApiError(403, "forbidden", "The recipient has blocked this sender");
    }

    const { policy } = await getMailboxPolicy(context.repository, input.recipient);

    if (BigInt(input.amount) < BigInt(policy.minimumPostage)) {
      throw new ApiError(422, "validation_error", "Postage is below the mailbox minimum", {
        minimumPostage: policy.minimumPostage,
      });
    }

    const result = await context.repository.setPostage({
      ...input,
      createdAt: now.toISOString(),
      status: "pending",
    });

    recordAuditEvent({
      actor: input.sender,
      action: "postage.submit",
      targetType: "message",
      safeTargetReference: input.messageId,
      result: "success",
      requestId: context.requestId ?? "unknown",
    });

    return result;
  } catch (error) {
    recordAuditEvent({
      actor: input.sender,
      action: "postage.submit",
      targetType: "message",
      safeTargetReference: input.messageId,
      result: "denied",
      requestId: context.requestId ?? "unknown",
    });
    throw error;
  }
}

export async function getPostage(repository: ApiRepository, messageId: string) {
  const postage = await repository.getPostage(messageId);

  if (!postage) {
    throw new ApiError(404, "not_found", "Postage was not found");
  }

  return postage;
}

export function assertPostageParticipant(postage: Postage, actor: string) {
  if (actor !== postage.sender && actor !== postage.recipient) {
    throw new ApiError(403, "forbidden", "Only message participants can read this postage");
  }
}

export async function resolvePostage(
  context: ApiContext,
  messageId: string,
  status: "refunded" | "settled",
) {
  const actor = context.principal?.address ?? "system";
  try {
    // Use an atomic compare-and-swap instead of get-then-set: two concurrent
    // settle/refund requests for the same message must not both succeed, and
    // every loser must observe the same deterministic terminal state rather
    // than racing to overwrite each other.
    const result = await context.repository.transitionPostage(messageId, "pending", status);

    if (result.outcome === "not-found") {
      throw new ApiError(404, "not_found", "Postage was not found");
    }

    if (result.outcome === "conflict") {
      const { postage } = result;

      // Provide detailed explanations for terminal states to aid debugging and retry logic
      const explanations: Record<string, string> = {
        settled:
          "Postage has already been settled. The escrow was previously released to the recipient.",
        refunded:
          "Postage has already been refunded. The escrow was previously returned to the sender.",
      };

      const explanation =
        explanations[postage.status] || `Postage is in terminal state: ${postage.status}`;

      throw new ApiError(409, "conflict", explanation, {
        currentStatus: postage.status,
        attemptedStatus: status,
        messageId,
      });
    }

    recordAuditEvent({
      actor,
      action: `postage.${status}`,
      targetType: "message",
      safeTargetReference: messageId,
      result: "success",
      requestId: context.requestId ?? "unknown",
    });

    return result.postage;
  } catch (error) {
    recordAuditEvent({
      actor,
      action: `postage.${status}`,
      targetType: "message",
      safeTargetReference: messageId,
      result: "denied",
      requestId: context.requestId ?? "unknown",
    });
    throw error;
  }
}
