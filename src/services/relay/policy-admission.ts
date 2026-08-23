/**
 * Live relay policy admission (Issue #1943 BETA-036).
 *
 * Resolves the recipient's current policy version, evaluates trusted / request /
 * verified / priced / blocked decisions, and returns immutable evidence that is
 * persisted with the accepted message. A later policy change cannot rewrite a
 * recorded admission because evidence is stored on the envelope, not re-read
 * from the live policy.
 *
 * Evaluation order:
 * 1. Simulate the Policies contract `evaluate` (live testnet / RPC).
 * 2. If the chain is unavailable, malformed, timed out, or stale relative to a
 *    *confirmed* off-chain write, fall back to {@link evaluateMailboxPolicy}.
 *
 * Denied decisions never proceed to payload storage — callers must gate the
 * object store on `allowed`.
 */
import {
  evaluateMailboxPolicy,
  policyDecisionKind,
  type PolicyDecisionKind,
  type PolicyReasonCode,
} from "@/server/api/policy-service";
import type { ApiRepository } from "@/server/api/repository";
import type { SenderRule } from "@/server/api/domain";

export type PolicyAdmissionSource = "chain" | "offchain_fallback";

export const DEFAULT_CHAIN_EVALUATION_TIMEOUT_MS = 2_000;

const POLICY_REASON_CODES: ReadonlySet<string> = new Set([
  "sender_allowed",
  "sender_blocked",
  "unknown_senders_disabled",
  "verification_required",
  "receipt_required",
  "insufficient_postage",
  "policy_satisfied",
  "tier_satisfied",
]);

const SENDER_RULES: ReadonlySet<string> = new Set(["default", "allow", "block"]);

export interface RelayAdmissionInput {
  owner: string;
  sender: string;
  postage: string;
  verified: boolean;
  receipt: boolean;
}

/**
 * Durable, privacy-safe admission evidence stored with an accepted message.
 * Contains no payload bytes, no full policy document, and no secrets.
 */
export interface RelayAdmissionEvidence {
  policyVersion: number;
  allowed: boolean;
  kind: PolicyDecisionKind;
  reason: PolicyReasonCode;
  rule: SenderRule;
  requiredPostage: string;
  source: PolicyAdmissionSource;
  evaluatedAt: string;
}

/** Sender-facing subset: enough to act, not enough to reconstruct mailbox policy. */
export interface SafeAdmissionDecision {
  kind: PolicyDecisionKind;
  reason: PolicyReasonCode;
  policyVersion: number;
  requiredPostage: string;
  allowed: boolean;
}

export interface ChainPolicyDecision {
  allowed: boolean;
  reason: PolicyReasonCode;
  requiredPostage: string;
  rule: SenderRule;
  version: number;
}

export interface PolicyChainClient {
  evaluate(input: RelayAdmissionInput): Promise<ChainPolicyDecision>;
}

export interface RelayAdmissionEvaluator {
  evaluate(input: RelayAdmissionInput): Promise<RelayAdmissionEvidence>;
}

export interface RelayAdmissionEvaluatorOptions {
  repository: ApiRepository;
  chain?: PolicyChainClient;
  chainTimeoutMs?: number;
  now?: () => Date;
}

export function toSafeAdmissionDecision(evidence: RelayAdmissionEvidence): SafeAdmissionDecision {
  return {
    kind: evidence.kind,
    reason: evidence.reason,
    policyVersion: evidence.policyVersion,
    requiredPostage: evidence.requiredPostage,
    allowed: evidence.allowed,
  };
}

export function createRelayAdmissionEvaluator(
  options: RelayAdmissionEvaluatorOptions,
): RelayAdmissionEvaluator {
  const timeoutMs = options.chainTimeoutMs ?? DEFAULT_CHAIN_EVALUATION_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());

  return {
    async evaluate(input: RelayAdmissionInput): Promise<RelayAdmissionEvidence> {
      const evaluatedAt = now().toISOString();
      const chainDecision = await tryChainEvaluate(options.chain, input, timeoutMs);

      if (chainDecision && (await isChainCurrent(options.repository, input.owner, chainDecision))) {
        return evidenceFromChain(chainDecision, evaluatedAt);
      }

      const offchain = await evaluateMailboxPolicy(options.repository, {
        owner: input.owner,
        sender: input.sender,
        postage: input.postage,
        verified: input.verified,
        receipt: input.receipt,
      });

      return {
        policyVersion: offchain.policyVersion,
        allowed: offchain.allowed,
        kind: offchain.kind,
        reason: offchain.reason,
        rule: offchain.rule,
        requiredPostage: offchain.requiredPostage,
        source: "offchain_fallback",
        evaluatedAt,
      };
    },
  };
}

function evidenceFromChain(
  decision: ChainPolicyDecision,
  evaluatedAt: string,
): RelayAdmissionEvidence {
  return {
    policyVersion: decision.version,
    allowed: decision.allowed,
    kind: policyDecisionKind(decision.reason, decision.requiredPostage),
    reason: decision.reason,
    rule: decision.rule,
    requiredPostage: decision.requiredPostage,
    source: "chain",
    evaluatedAt,
  };
}

/**
 * A chain result is stale when a confirmed off-chain write is strictly newer
 * than the version the RPC returned. Pending/submitted writes are *not* stale:
 * the ledger is still the live admission source until the write confirms.
 */
async function isChainCurrent(
  repository: ApiRepository,
  owner: string,
  chain: ChainPolicyDecision,
): Promise<boolean> {
  const intent = await repository.getPolicyWriteIntent(owner);
  if (!intent || intent.status !== "confirmed") return true;
  return chain.version >= intent.offchainVersion;
}

async function tryChainEvaluate(
  chain: PolicyChainClient | undefined,
  input: RelayAdmissionInput,
  timeoutMs: number,
): Promise<ChainPolicyDecision | null> {
  if (!chain) return null;
  try {
    const raw = await withTimeout(chain.evaluate(input), timeoutMs);
    return parseChainDecision(raw);
  } catch {
    return null;
  }
}

function parseChainDecision(
  raw: ChainPolicyDecision | null | undefined,
): ChainPolicyDecision | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.allowed !== "boolean") return null;
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 0) {
    return null;
  }
  if (!POLICY_REASON_CODES.has(raw.reason)) return null;
  if (!SENDER_RULES.has(raw.rule)) return null;
  if (typeof raw.requiredPostage !== "string") return null;
  try {
    if (BigInt(raw.requiredPostage) < 0n) return null;
  } catch {
    return null;
  }
  return {
    allowed: raw.allowed,
    reason: raw.reason,
    requiredPostage: raw.requiredPostage,
    rule: raw.rule,
    version: raw.version,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const startedAt = Date.now();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error("chain_evaluation_timeout"))),
      timeoutMs,
    );
    promise.then(
      (value) => {
        if (Date.now() - startedAt >= timeoutMs) {
          finish(() => reject(new Error("chain_evaluation_timeout")));
          return;
        }
        finish(() => resolve(value));
      },
      (error) => finish(() => reject(error)),
    );
  });
}
