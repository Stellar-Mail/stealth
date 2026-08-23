/**
 * Live Policies-contract adapter for relay admission (Issue #1943 BETA-036).
 *
 * Wraps the generated Soroban client so relay admission can simulate
 * `evaluate` against the deployed testnet contract. Reads never log payload
 * bytes, keys, or account secrets.
 */
import {
  createPoliciesClient,
  evaluate,
  PolicyReason,
  SenderRule as ChainSenderRule,
  type PoliciesClientOptions,
} from "@/services/stellar/contracts/policies";

import {
  createRelayAdmissionEvaluator,
  type ChainPolicyDecision,
  type PolicyChainClient,
  type RelayAdmissionEvaluator,
  type RelayAdmissionInput,
} from "./policy-admission";
import type { PolicyReasonCode } from "@/server/api/policy-service";
import type { SenderRule } from "@/server/api/domain";
import type { ApiRepository } from "@/server/api/repository";

export interface LivePolicyChainOptions extends PoliciesClientOptions {
  /** Optional override used by tests. */
  evaluateFn?: typeof evaluate;
}

const REASON_BY_VARIANT: Record<PolicyReason, PolicyReasonCode> = {
  [PolicyReason.SenderAllowed]: "sender_allowed",
  [PolicyReason.SenderBlocked]: "sender_blocked",
  [PolicyReason.UnknownSendersDisabled]: "unknown_senders_disabled",
  [PolicyReason.VerificationRequired]: "verification_required",
  [PolicyReason.ReceiptRequired]: "receipt_required",
  [PolicyReason.InsufficientPostage]: "insufficient_postage",
  [PolicyReason.PolicySatisfied]: "policy_satisfied",
  [PolicyReason.TierSatisfied]: "tier_satisfied",
};

const RULE_BY_VARIANT: Record<ChainSenderRule, SenderRule> = {
  [ChainSenderRule.Default]: "default",
  [ChainSenderRule.Allow]: "allow",
  [ChainSenderRule.Block]: "block",
};

/**
 * True when `contractId` is a live (non-placeholder) Policies contract id.
 * Repeated-letter development placeholders such as `CCCCC…` are not live.
 */
export function isLivePoliciesContractId(contractId: string | undefined): boolean {
  if (!contractId) return false;
  if (contractId.includes("PLACEHOLDER") || contractId === "placeholder") return false;
  if (!/^C[A-Z0-9]{55}$/.test(contractId)) return false;
  return !/^C([A-Z0-9])\1{54}$/.test(contractId);
}

export function createLivePolicyChainClient(options: LivePolicyChainOptions): PolicyChainClient {
  const client = createPoliciesClient({
    contractId: options.contractId,
    networkPassphrase: options.networkPassphrase,
    rpcUrl: options.rpcUrl,
    publicKey: options.publicKey,
  });
  const evaluateFn = options.evaluateFn ?? evaluate;

  return {
    async evaluate(input: RelayAdmissionInput): Promise<ChainPolicyDecision> {
      const decision = await evaluateFn(
        client,
        input.owner,
        input.sender,
        input.verified,
        BigInt(input.postage),
        input.receipt,
      );
      return {
        allowed: decision.allowed,
        reason: mapReason(decision.reason),
        requiredPostage: decision.required_postage.toString(),
        rule: mapRule(decision.rule),
        version: decision.version,
      };
    },
  };
}

function mapReason(reason: PolicyReason): PolicyReasonCode {
  const mapped = REASON_BY_VARIANT[reason];
  if (!mapped) {
    throw new Error("malformed_chain_reason");
  }
  return mapped;
}

function mapRule(rule: ChainSenderRule): SenderRule {
  const mapped = RULE_BY_VARIANT[rule];
  if (!mapped) {
    throw new Error("malformed_chain_rule");
  }
  return mapped;
}

export interface ConfiguredAdmissionOptions {
  repository: ApiRepository;
  policiesContractId?: string;
  networkPassphrase: string;
  sorobanRpcUrl: string;
  chainTimeoutMs?: number;
  now?: () => Date;
}

/**
 * Builds the production admission evaluator: live chain when a real Policies
 * contract id is configured, otherwise off-chain evaluation only.
 */
export function createConfiguredAdmissionEvaluator(
  options: ConfiguredAdmissionOptions,
): RelayAdmissionEvaluator {
  const chain = isLivePoliciesContractId(options.policiesContractId)
    ? createLivePolicyChainClient({
        contractId: options.policiesContractId!,
        networkPassphrase: options.networkPassphrase,
        rpcUrl: options.sorobanRpcUrl,
      })
    : undefined;

  return createRelayAdmissionEvaluator({
    repository: options.repository,
    chain,
    chainTimeoutMs: options.chainTimeoutMs,
    now: options.now,
  });
}
