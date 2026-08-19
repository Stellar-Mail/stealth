/**
 * Relay policy admission (Issue #1943 BETA-036).
 *
 * Resolves the recipient's current policy version (live chain first, off-chain
 * fallback when the ledger is stale or unavailable), evaluates the contract
 * decision tree, and returns safe evidence the relay can persist with the
 * message. Blocked decisions never include a payload.
 */

import { ApiError } from "@/server/api/errors";
import {
  ADMISSION_REASON_MESSAGES,
  evaluateAdmissionDecision,
  selectAdmissionSnapshot,
  toAdmissionEvidence,
  type AdmissionPolicySnapshot,
} from "@/server/api/policy-admission";
import { loadOffchainAdmissionSnapshot } from "@/server/api/policy-service";
import type { AdmissionEvidence } from "@/server/api/domain";
import type { ApiRepository } from "@/server/api/repository";
import {
  contractPolicyToChain,
  type PolicyChainClient,
} from "@/services/stellar/policy-chain-client";

export interface RelayAdmissionInput {
  owner: string;
  sender: string;
  postage: string;
  verified: boolean;
  receipt: boolean;
}

export interface RelayAdmissionEvaluator {
  evaluate(input: RelayAdmissionInput): Promise<AdmissionEvidence>;
}

export interface RelayAdmissionDependencies {
  repository: ApiRepository;
  chainClient?: PolicyChainClient | null;
  now?: () => Date;
}

export async function evaluateRelayAdmission(
  deps: RelayAdmissionDependencies,
  input: RelayAdmissionInput,
): Promise<AdmissionEvidence> {
  const offchain = await loadOffchainAdmissionSnapshot(deps.repository, input.owner, input.sender);
  const chain = await readChainSnapshot(deps.chainClient ?? null, input.owner, input.sender);
  const { snapshot, source } = selectAdmissionSnapshot({ offchain, chain });
  const decision = evaluateAdmissionDecision(snapshot, input);
  const evaluatedAt = (deps.now ?? (() => new Date()))().toISOString();
  return toAdmissionEvidence(decision, snapshot.policy, source, evaluatedAt);
}

export function createRelayAdmissionEvaluator(
  deps: RelayAdmissionDependencies,
): RelayAdmissionEvaluator {
  return {
    evaluate: (input) => evaluateRelayAdmission(deps, input),
  };
}

async function readChainSnapshot(
  chainClient: PolicyChainClient | null,
  owner: string,
  sender: string,
): Promise<AdmissionPolicySnapshot | null> {
  if (!chainClient) return null;
  try {
    const versioned = await chainClient.readVersionedPolicy(owner);
    if (!versioned) return null;
    const rule = (await chainClient.readSenderRule(owner, sender)) ?? "default";
    const tier = await chainClient.readSenderTier(owner, sender);
    return {
      policy: contractPolicyToChain(versioned.policy),
      version: versioned.version,
      rule,
      tier,
    };
  } catch {
    return null;
  }
}

/** Public, payload-free decision the sender can act on. */
export function publicAdmissionDecision(evidence: AdmissionEvidence) {
  return {
    allowed: evidence.allowed,
    disposition: evidence.disposition,
    reason: evidence.reason,
    policyVersion: evidence.policyVersion,
    requiredPostage: evidence.requiredPostage,
    rule: evidence.rule,
    source: evidence.source,
    message: ADMISSION_REASON_MESSAGES[evidence.reason],
  };
}

export function admissionDenialError(evidence: AdmissionEvidence): ApiError {
  const details = publicAdmissionDecision(evidence);
  if (evidence.reason === "insufficient_postage") {
    return new ApiError(
      422,
      "insufficient_postage",
      ADMISSION_REASON_MESSAGES[evidence.reason],
      details,
    );
  }
  return new ApiError(403, "forbidden", ADMISSION_REASON_MESSAGES[evidence.reason], details);
}
