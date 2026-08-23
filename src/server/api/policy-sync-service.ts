import { loadRuntimeConfig } from "../../config";
import {
  createPolicyChainClient,
  InMemoryPolicyChainClient,
  type PolicyChainClient,
} from "../../services/stellar/policy-chain-client";
import { recordAuditEvent } from "./audit";
import type { ApiRepository } from "./repository";
import type { SenderRuleRecord } from "./domain";
import {
  confirmPolicyWrite,
  failPolicyWrite,
  getPolicyWriteIntent,
  submitPolicyWrite,
  confirmSenderRuleWrite,
  failSenderRuleWrite,
  getSenderRuleWriteIntent,
  submitSenderRuleWrite,
  scheduleSenderRuleWrite,
} from "./policy-service";
import { getSenderRuleRecord, transitionSenderRuleChainStatus } from "./sender-rule-service";

export interface PolicySyncResult {
  owner: string;
  sender?: string;
  kind: "mailbox" | "sender";
  status: "synced" | "skipped" | "failed";
  txHash?: string;
  error?: string;
}

export interface PolicySyncDependencies {
  chainClient?: PolicyChainClient;
}

function resolveChainClient(deps: PolicySyncDependencies = {}): PolicyChainClient {
  if (deps.chainClient) return deps.chainClient;
  try {
    return createPolicyChainClient(loadRuntimeConfig()) ?? new InMemoryPolicyChainClient();
  } catch {
    return new InMemoryPolicyChainClient();
  }
}

export async function syncMailboxPolicyWrite(
  repository: ApiRepository,
  owner: string,
  requestId = "policy-sync",
  deps: PolicySyncDependencies = {},
): Promise<PolicySyncResult> {
  const chainClient = resolveChainClient(deps);
  const intent = await getPolicyWriteIntent(repository, owner);

  if (!intent || (intent.status !== "pending" && intent.status !== "failed")) {
    return { owner, kind: "mailbox", status: "skipped" };
  }

  try {
    await submitPolicyWrite(repository, owner);
    const { txHash } = await chainClient.submitMailboxPolicyWrite(
      owner,
      intent.policy,
      owner,
      requestId,
    );
    await confirmPolicyWrite(repository, owner, txHash);
    recordAuditEvent({
      actor: owner,
      action: "policy.write.confirmed",
      targetType: "policy",
      safeTargetReference: `policy:${owner}`,
      result: "success",
      requestId,
    });
    return { owner, kind: "mailbox", status: "synced", txHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : "policy sync failed";
    await failPolicyWrite(repository, owner, message);
    recordAuditEvent({
      actor: owner,
      action: "policy.write.failed",
      targetType: "policy",
      safeTargetReference: `policy:${owner}`,
      result: "denied",
      requestId,
    });
    return { owner, kind: "mailbox", status: "failed", error: message };
  }
}

export async function syncSenderRuleWrite(
  repository: ApiRepository,
  owner: string,
  sender: string,
  requestId = "policy-sync",
  deps: PolicySyncDependencies = {},
): Promise<PolicySyncResult> {
  const chainClient = resolveChainClient(deps);
  const intent = await getSenderRuleWriteIntent(repository, owner, sender);

  if (!intent || (intent.status !== "pending" && intent.status !== "failed")) {
    return { owner, sender, kind: "sender", status: "skipped" };
  }

  try {
    await submitSenderRuleWrite(repository, owner, sender);
    let txHash: string;
    if (intent.rule === "price") {
      if (!intent.minimumPostage) {
        throw new Error("price sender rule is missing minimumPostage");
      }
      ({ txHash } = await chainClient.submitSenderTierWrite(
        owner,
        sender,
        intent.minimumPostage,
        owner,
        requestId,
      ));
    } else {
      ({ txHash } = await chainClient.submitSenderRuleWrite(
        owner,
        sender,
        intent.rule,
        owner,
        requestId,
      ));
    }
    await confirmSenderRuleWrite(repository, owner, sender, txHash);
    recordAuditEvent({
      actor: owner,
      action: "policy.sender_rule.confirmed",
      targetType: "policy",
      safeTargetReference: `policy:${owner}:senders:${sender}`,
      result: "success",
      requestId,
    });
    return { owner, sender, kind: "sender", status: "synced", txHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : "sender rule sync failed";
    await failSenderRuleWrite(repository, owner, sender, message);
    recordAuditEvent({
      actor: owner,
      action: "policy.sender_rule.failed",
      targetType: "policy",
      safeTargetReference: `policy:${owner}:senders:${sender}`,
      result: "denied",
      requestId,
    });
    return { owner, sender, kind: "sender", status: "failed", error: message };
  }
}

export async function syncAllPendingPolicyWrites(
  repository: ApiRepository,
  owner: string,
  requestId = "policy-sync",
  deps: PolicySyncDependencies = {},
): Promise<PolicySyncResult[]> {
  const results: PolicySyncResult[] = [];
  results.push(await syncMailboxPolicyWrite(repository, owner, requestId, deps));

  const senderIntents = await repository.listSenderRuleWriteIntents(owner);
  for (const intent of senderIntents) {
    if (intent.status === "pending" || intent.status === "failed") {
      results.push(await syncSenderRuleWrite(repository, owner, intent.sender, requestId, deps));
    }
  }
  return results;
}

/**
 * Schedules and synchronizes a versioned sender rule record created by the HTTP API.
 * Verify rules are off-chain only; price rules use `set_sender_tier`.
 */
export async function syncVersionedSenderRuleRecord(
  repository: ApiRepository,
  record: SenderRuleRecord,
  requestId = "policy-sync",
  deps: PolicySyncDependencies = {},
): Promise<SenderRuleRecord> {
  const { owner, sender } = record;

  if (record.rule === "verify") {
    await scheduleSenderRuleWrite(repository, owner, sender, "default");
    const clearResult = await syncSenderRuleWrite(repository, owner, sender, requestId, deps);
    if (clearResult.status === "failed") {
      return transitionSenderRuleChainStatus(repository, owner, sender, "failed", {
        lastError: clearResult.error ?? "failed to clear on-chain sender override",
      });
    }
    return transitionSenderRuleChainStatus(repository, owner, sender, "confirmed", {
      txHash: clearResult.txHash,
    });
  }

  await scheduleSenderRuleWrite(repository, owner, sender, record.rule, {
    minimumPostage: record.rule === "price" ? record.pricePayload?.minimumPostage : null,
  });

  const result = await syncSenderRuleWrite(repository, owner, sender, requestId, deps);
  if (result.status === "synced") {
    return transitionSenderRuleChainStatus(repository, owner, sender, "confirmed", {
      txHash: result.txHash,
    });
  }
  if (result.status === "failed") {
    return transitionSenderRuleChainStatus(repository, owner, sender, "failed", {
      lastError: result.error ?? "sender rule sync failed",
    });
  }

  return (await getSenderRuleRecord(repository, owner, sender)) ?? record;
}
