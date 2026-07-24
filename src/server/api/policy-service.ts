import type { MailboxPolicy, SenderRule } from "./domain";
import type { ApiRepository } from "./repository";
import { defaultMailboxPolicy } from "./repository";

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
) {
  return {
    owner,
    policy: await repository.setPolicy(owner, policy, policy.version),
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
  if (rule === "allow") return { allowed: true, reason: "sender_allowed" as const, rule };
  if (rule === "block") return { allowed: false, reason: "sender_blocked" as const, rule };

  const { policy } = await getMailboxPolicy(repository, input.owner);
  if (!policy.allowUnknown) {
    return { allowed: false, policy, reason: "unknown_senders_disabled" as const, rule };
  }
  if (policy.requireVerified && !input.verified) {
    return { allowed: false, policy, reason: "verification_required" as const, rule };
  }
  if (BigInt(input.postage) < BigInt(policy.minimumPostage)) {
    return { allowed: false, policy, reason: "insufficient_postage" as const, rule };
  }

  return { allowed: true, policy, reason: "policy_satisfied" as const, rule };
}
