import type { Postage } from "./domain";
import { ApiError } from "./errors";
import {
  checkAccountLimit,
  checkDeviceLimit,
  checkIpLimit,
  checkRelayLimit,
  checkSenderRecipientLimit,
} from "./abuse-service";
import { getMailboxPolicy } from "./policy-service";
import * as metrics from "./metrics";
import type { ApiRepository } from "./repository";
import { signPostageQuote, verifyPostageQuote } from "./postage-quote";

export type SubmitPostageContext = {
  actorId?: string;
  fingerprint?: string;
  ip?: string;
  relayId?: string;
  sender?: string;
};

export async function quotePostage(
  repository: ApiRepository,
  input: { recipient: string; sender: string; messageId: string },
) {
  const rule = await repository.getSenderRule(input.recipient, input.sender);
  const { policy } = await getMailboxPolicy(repository, input.recipient);
  const policyVersion = await repository.getPolicyVersion(input.recipient);

  if (rule === "block") {
    const amount = policy.minimumPostage;
    return {
      amount,
      eligible: false,
      reason: "sender_blocked" as const,
      trusted: false,
      quote: signPostageQuote({
        sender: input.sender,
        recipient: input.recipient,
        messageId: input.messageId,
        amount,
        policyVersion,
      }),
    };
  }

  const trusted = rule === "allow";
  const amount = trusted ? "0" : policy.minimumPostage;

  return {
    amount,
    eligible: true,
    reason: trusted ? ("trusted_sender" as const) : ("mailbox_minimum" as const),
    trusted,
    quote: signPostageQuote({
      sender: input.sender,
      recipient: input.recipient,
      messageId: input.messageId,
      amount,
      policyVersion,
    }),
  };
}

export async function submitPostage(
  repository: ApiRepository,
  input: Omit<Postage, "createdAt" | "status">,
  now = new Date(),
  context: SubmitPostageContext = {},
  quoteToken?: string,
) {
  const actorId = context.actorId ?? "unknown";

  const accountLimit = await checkAccountLimit(repository, input.sender);
  if (!accountLimit.allowed) {
    metrics.incrementCounter("postage_limit_rejected", {
      actorId,
      limit: "account",
    });

    throw new ApiError(429, "too_many_requests", "Account limit exceeded", {
      retryAfterSeconds: accountLimit.retryAfterSeconds,
    });
  }

  const ip = context.ip ?? "unknown";
  const ipLimit = await checkIpLimit(repository, ip);
  if (!ipLimit.allowed) {
    metrics.incrementCounter("postage_limit_rejected", {
      ip,
      limit: "ip",
    });

    throw new ApiError(429, "too_many_requests", "IP limit exceeded", {
      retryAfterSeconds: ipLimit.retryAfterSeconds,
    });
  }

  const fingerprint = context.fingerprint ?? "";
  const deviceLimit = await checkDeviceLimit(repository, fingerprint);
  if (!deviceLimit.allowed) {
    metrics.incrementCounter("postage_limit_rejected", {
      fingerprint: fingerprint || "unknown",
      limit: "device",
    });

    throw new ApiError(429, "too_many_requests", "Device limit exceeded", {
      retryAfterSeconds: deviceLimit.retryAfterSeconds,
    });
  }

  const senderRecipientLimit = await checkSenderRecipientLimit(
    repository,
    input.sender,
    input.recipient,
  );

  if (!senderRecipientLimit.allowed) {
    const sender = context.sender ?? input.sender;

    metrics.incrementCounter("postage_limit_rejected", {
      limit: "sender_recipient",
      sender,
    });

    throw new ApiError(429, "too_many_requests", "Sender-recipient limit exceeded", {
      retryAfterSeconds: senderRecipientLimit.retryAfterSeconds,
    });
  }

  const relayId = context.relayId?.trim() || "unknown";
  const relayLimit = await checkRelayLimit(repository, relayId);

  if (!relayLimit.allowed) {
    metrics.incrementCounter("postage_limit_rejected", {
      limit: "relay",
      relayId,
    });

    throw new ApiError(429, "too_many_requests", "Relay limit exceeded", {
      retryAfterSeconds: relayLimit.retryAfterSeconds,
    });
  }

  if (await repository.getPostage(input.messageId)) {
    throw new ApiError(409, "conflict", "Postage already exists for this message");
  }

  const rule = await repository.getSenderRule(input.recipient, input.sender);

  if (rule === "block") {
    throw new ApiError(403, "forbidden", "The recipient has blocked this sender");
  }

  const { policy } = await getMailboxPolicy(repository, input.recipient);

  if (quoteToken) {
    const policyVersion = await repository.getPolicyVersion(input.recipient);
    // Integrity/authorization check before the business-rule check below:
    // a tampered or stale quote should never fall through to a minimum-
    // postage error that leaks policy details to an unbound caller.
    verifyPostageQuote(quoteToken, {
      sender: input.sender,
      recipient: input.recipient,
      messageId: input.messageId,
      amount: input.amount,
      policyVersion,
    });
  }

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
  const postage = await getPostage(repository, messageId);

  if (postage.status !== "pending") {
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

  return repository.setPostage({ ...postage, status });
}
