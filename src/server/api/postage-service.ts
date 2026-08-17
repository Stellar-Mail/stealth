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
  context: ApiContext,
  input: { recipient: string; sender: string },
) {
  try {
    const rule = await context.repository.getSenderRule(input.recipient, input.sender);
    const { policy } = await getMailboxPolicy(context.repository, input.recipient);

    const issuedAt = new Date().toISOString();
    const lifetimeMs = process.env.STEALTH_QUOTE_LIFETIME_MS
      ? parseInt(process.env.STEALTH_QUOTE_LIFETIME_MS, 10)
      : 15 * 60 * 1000;
    const expiresAt = new Date(Date.now() + lifetimeMs).toISOString();

    if (rule === "block") {
      const amount = policy.minimumPostage;
      const result = {
        amount,
        eligible: false,
        reason: "sender_blocked" as const,
        trusted: false,
        issuedAt,
        expiresAt,
        digest: signQuote(input.recipient, input.sender, amount, issuedAt, expiresAt),
      };

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

    const result = {
      amount,
      eligible: true,
      reason: trusted ? ("trusted_sender" as const) : ("mailbox_minimum" as const),
      trusted,
      issuedAt,
      expiresAt,
      digest: signQuote(input.recipient, input.sender, amount, issuedAt, expiresAt),
    };

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
