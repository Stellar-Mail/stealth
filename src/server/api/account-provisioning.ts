import type { ChainMailboxPolicy } from "./domain";
import {
  betaDefaultMailboxPolicy,
  getMailboxPolicy,
  getPolicyWriteIntent,
  setMailboxPolicy,
  toChainMailboxPolicy,
} from "./policy-service";
import type { ApiRepository } from "./repository";

// ---------------------------------------------------------------------------
// BETA-023 (Issue #1930) — privacy-safe mailbox policy defaults during
// provisioning.
//
// This module is the isolated policy-initialization slice of the transactional
// account-provisioning orchestrator (BETA-014 / Issue #1921). It guarantees
// that provisioning leaves every account with an evaluable, privacy-safe
// default policy and a durable intent for the matching testnet contract write.
//
// The orchestrator (once BETA-014 merges) calls `initializeMailboxPolicyDefaults`
// inside its transactional flow; the POST /policies/{owner}/provision route
// exposes the same entrypoint for the beta walkthrough and retries.
// ---------------------------------------------------------------------------

export interface InitializePolicyDefaultsResult {
  /** False when the owner already had a (possibly customized) policy. */
  provisioned: boolean;
  policy: ChainMailboxPolicy;
  source: "default" | "configured";
  offchainVersion: number | null;
  scheduled: boolean;
}

/**
 * Idempotently initializes the privacy-safe beta mailbox policy defaults for
 * `owner`.
 *
 * - No policy exists: persists the beta default off-chain and schedules the
 *   matching testnet contract write at off-chain version 1.
 * - A policy already exists (including a user-customized one): no write and no
 *   version bump. Provisioning retries therefore never re-submit an identical
 *   write and never inflate the on-chain policy version.
 */
export async function initializeMailboxPolicyDefaults(
  repository: ApiRepository,
  owner: string,
  now = new Date(),
): Promise<InitializePolicyDefaultsResult> {
  const existing = await getMailboxPolicy(repository, owner);
  const intent = await getPolicyWriteIntent(repository, owner);

  if (existing.source === "configured") {
    return {
      provisioned: false,
      policy: toChainMailboxPolicy(existing.policy, intent?.policy.requireReceipt),
      source: "configured",
      offchainVersion: intent?.offchainVersion ?? null,
      scheduled: false,
    };
  }

  const result = await setMailboxPolicy(
    repository,
    owner,
    {
      allowUnknown: betaDefaultMailboxPolicy.allowUnknown,
      requireVerified: betaDefaultMailboxPolicy.requireVerified,
      minimumPostage: betaDefaultMailboxPolicy.minimumPostage,
    },
    { requireReceipt: betaDefaultMailboxPolicy.requireReceipt },
  );

  const scheduled = await getPolicyWriteIntent(repository, owner);
  return {
    provisioned: true,
    policy: scheduled?.policy ?? betaDefaultMailboxPolicy,
    source: "default",
    offchainVersion: scheduled?.offchainVersion ?? null,
    scheduled: scheduled !== null,
  };
}
