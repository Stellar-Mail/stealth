import type { Postage } from "./domain";
import { ApiError } from "./errors";
import { getMailboxPolicy } from "./policy-service";
import type { ApiRepository } from "./repository";
import { withAbuseProtection } from "./with-abuse-protection";

export type SubmitPostageContext = {
  actorId?: string;
  fingerprint?: string;
  ip?: string;
  relayId?: string;
  sender?: string;
};

export async function getPostage(
  repository: ApiRepository,
  messageId: string,
): Promise<Postage | null> {
  return repository.getPostage(messageId);
}

export async function quotePostage(
  repository: ApiRepository,
  input: { recipient: string; sender: string },
) {
  const rule = await repository.getSenderRule(input.recipient, input.sender);
  const { policy } = await getMailboxPolicy(repository, input.recipient);

  if (rule === "block") {
    return {
      amount: policy.minimumPostage,
      eligible: false,
      reason: "sender_blocked" as const,
      trusted: false,
    };
  }

  const trusted = rule === "allow";

  return {
    amount: trusted ? "0" : policy.minimumPostage,
    eligible: true,
    reason: trusted ? ("trusted_sender" as const) : ("mailbox_minimum" as const),
    trusted,
  };
}

export async function submitPostage(
  repository: ApiRepository,
  input: Omit<Postage, "createdAt" | "status">,
  now = new Date(),
  context: SubmitPostageContext = {},
) {
  const policy = {
    checkAccount: true,
    checkIp: true,
    checkDevice: true,
    checkSenderRecipient: true,
    checkRelay: true,
  };

  const abuseContext = {
    actorId: context.actorId,
    sender: input.sender,
    recipient: input.recipient,
    ip: context.ip || "unknown",
    fingerprint: context.fingerprint || "",
    relayId: context.relayId?.trim() || "unknown",
  };

  return withAbuseProtection(repository, policy, abuseContext, async () => {
    if (await repository.getPostage(input.messageId)) {
      throw new ApiError(409, "conflict", "Postage already exists for this message");
    }

    const rule = await repository.getSenderRule(input.recipient, input.sender);

    if (rule === "block") {
      throw new ApiError(403, "forbidden", "The recipient has blocked this sender");
    }

    const { policy: mailboxPolicy } = await getMailboxPolicy(repository, input.recipient);

    if (BigInt(input.amount) < BigInt(mailboxPolicy.minimumPostage)) {
      throw new ApiError(422, "validation_error", "Postage is below the mailbox minimum", {
        minimumPostage: mailboxPolicy.minimumPostage,
      });
    }

    return repository.setPostage({
      ...input,
      createdAt: now.toISOString(),
      status: "pending",
    });
  });
}

export async function resolvePostage(
  repository: ApiRepository,
  messageId: string,
  resolution: "settled" | "refunded",
) {
  const result = await repository.transitionPostage(messageId, "pending", resolution);

  if (result.outcome === "not-found") {
    throw new ApiError(404, "not_found", "Postage was not found");
  }

  if (result.outcome === "conflict") {
    const { postage } = result;

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
      attemptedStatus: resolution,
      messageId,
    });
  }

  return result.postage;
}
