import type { MailboxPolicy, SenderRule } from "./domain";
import type { ApiRepository } from "./repository";
import { defaultMailboxPolicy } from "./repository";
import { logPolicyAuditEvent, type AuditEventContext } from "./audit-service";

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
  ctx?: AuditEventContext,
) {
  let beforeState: MailboxPolicy | null = null;
  try {
    const existing = await repository.getPolicy(owner);
    beforeState = existing ?? defaultMailboxPolicy;
  } catch {
    // Gracefully fallback if pre-fetch fails
  }

  try {
    const updatedPolicy = await repository.setPolicy(owner, policy);
    
    if (ctx) {
      logPolicyAuditEvent({
        ctx,
        owner,
        action: "update_mailbox_policy",
        targetType: "mailbox_policy",
        before: beforeState,
        after: updatedPolicy,
        status: "success",
      });
    }

    return {
      owner,
      policy: updatedPolicy,
      source: "configured" as const,
    };
  } catch (error) {
    if (ctx) {
      logPolicyAuditEvent({
        ctx,
        owner,
        action: "update_mailbox_policy",
        targetType: "mailbox_policy",
        before: beforeState,
        after: null,
        status: "failure",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
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
  ctx?: AuditEventContext,
) {
  let beforeRule: SenderRule = "default";
  try {
    beforeRule = await repository.getSenderRule(owner, sender);
  } catch {
    // Gracefully fallback if pre-fetch fails
  }

  const isDelete = rule === "default";
  const actionName = isDelete ? "delete_sender_rule" : "update_sender_rule";

  try {
    const updatedRule = await repository.setSenderRule(owner, sender, rule);

    if (ctx) {
      logPolicyAuditEvent({
        ctx,
        owner,
        action: actionName,
        targetType: "sender_rule",
        sender,
        before: beforeRule,
        after: updatedRule,
        status: "success",
      });
    }

    return {
      owner,
      rule: updatedRule,
      sender,
    };
  } catch (error) {
    if (ctx) {
      logPolicyAuditEvent({
        ctx,
        owner,
        action: actionName,
        targetType: "sender_rule",
        sender,
        before: beforeRule,
        after: null,
        status: "failure",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
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
