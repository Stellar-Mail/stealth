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
import * as metrics from "./metrics";
import type { ApiRepository } from "./repository";

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

export function signQuote(
  recipient: string,
  sender: string,
  amount: string,
  issuedAt: string,
  expiresAt: string,
): string {
  const secret = SECRET();
  if (!secret) {
    throw new ApiError(500, "internal_error", "Quote signing secret is not configured");
  }
  const payload = `${recipient}:${sender}:${amount}:${issuedAt}:${expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function quotePostage(
  repository: ApiRepository,
  input: { recipient: string; sender: string },
) {
  const rule = await repository.getSenderRule(input.recipient, input.sender);
  const { policy } = await getMailboxPolicy(repository, input.recipient);

  const issuedAt = new Date().toISOString();
  const lifetimeMs = process.env.STEALTH_QUOTE_LIFETIME_MS
    ? parseInt(process.env.STEALTH_QUOTE_LIFETIME_MS, 10)
    : 15 * 60 * 1000;
  const expiresAt = new Date(Date.now() + lifetimeMs).toISOString();

  if (rule === "block") {
    const amount = policy.minimumPostage;
    return {
      amount,
      eligible: false,
      reason: "sender_blocked" as const,
      trusted: false,
      issuedAt,
      expiresAt,
      digest: signQuote(input.recipient, input.sender, amount, issuedAt, expiresAt),
    };
  }

  const trusted = rule === "allow";
  const amount = trusted ? "0" : policy.minimumPostage;

  return {
    amount,
    eligible: true,
    reason: trusted ? ("trusted_sender" as const) : ("mailbox_minimum" as const),
    trusted,
    issuedAt,
    expiresAt,
    digest: signQuote(input.recipient, input.sender, amount, issuedAt, expiresAt),
  };
}

export async function submitPostage(
  repository: ApiRepository,
  input: Omit<Postage, "createdAt" | "status">,
  now = new Date(),
  context: SubmitPostageContext = {},
) {
  const actorId = context.actorId ?? "unknown";

  const accountLimit = await checkAccountLimit(repository, input.sender);
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

  const ip = context.ip ?? "unknown";
  const ipLimit = await checkIpLimit(repository, ip);
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

  const fingerprint = context.fingerprint ?? "";
  const deviceLimit = await checkDeviceLimit(repository, fingerprint);
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
    repository,
    input.sender,
    input.recipient,
  );

  if (!senderRecipientLimit.allowed) {
    const sender = context.sender ?? input.sender;

    rejectLimitedPostage(
      senderRecipientLimit,
      {
        limit: "sender_recipient",
        sender,
      },
      "Sender-recipient limit exceeded",
    );
  }

  const relayId = context.relayId?.trim() || "unknown";
  const relayLimit = await checkRelayLimit(repository, relayId);

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

  if (await repository.getPostage(input.messageId)) {
    throw new ApiError(409, "conflict", "Postage already exists for this message");
  }

  const rule = await repository.getSenderRule(input.recipient, input.sender);

  if (rule === "block") {
    throw new ApiError(403, "forbidden", "The recipient has blocked this sender");
  }

  const { policy } = await getMailboxPolicy(repository, input.recipient);

  if (BigInt(input.amount) < BigInt(policy.minimumPostage)) {
    throw new ApiError(422, "validation_error", "Postage is below the mailbox minimum", {
      minimumPostage: policy.minimumPostage,
    });
  }

  return repository.setPostage({
    ...input,
    createdAt: now.toISOString(),
    status: "pending",
  });
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
  repository: ApiRepository,
  messageId: string,
  status: "refunded" | "settled",
) {
  // Use an atomic compare-and-swap instead of get-then-set: two concurrent
  // settle/refund requests for the same message must not both succeed, and
  // every loser must observe the same deterministic terminal state rather
  // than racing to overwrite each other.
  const result = await repository.transitionPostage(messageId, "pending", status);

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

  return result.postage;
}
