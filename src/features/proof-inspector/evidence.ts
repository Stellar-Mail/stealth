// ---------------------------------------------------------------------------
// BETA-063 (Issue #1970) — proof evidence from real message, storage and
// testnet.
//
// The proof inspector previously derived every proof from seeded messages.
// This module aggregates evidence from three real sources instead:
//   - message evidence: the decrypted envelope provenance (`email.provenanceData`)
//     produced by the live-thread reader (BETA-055),
//   - storage evidence: mailbox descriptor fields carried on the `Email`,
//   - testnet evidence: postage escrow, delivery/read receipts, lifecycle
//     anchors and policy reconciliation fetched through the typed API layer.
//
// Classification is a pure function so unit tests can feed valid, pending,
// missing, mismatched and tampered fixtures without any network. Fetching goes
// through an injected `ProofEvidenceApi` (the production path uses
// `sharedTypedApi`); 404s become "missing" evidence, everything else surfaces
// as a normalized error the inspector can present with a safe retry.
// ---------------------------------------------------------------------------

import { ApiClientError } from "@/lib/api";
import type {
  LifecycleAnchorRecord,
  PolicyReconciliation,
  PostageRecord,
  ReceiptRecord,
} from "@/lib/api";
import type { Email } from "@/components/mail/data";

export type ProofCheckState = "verified" | "pending" | "missing" | "mismatched" | "tampered";

export type ProofSource = "message" | "storage" | "testnet" | "contract";

export interface ProofCheck {
  key: string;
  label: string;
  state: ProofCheckState;
  detail: string;
  copyable?: string;
  explorerUrl?: string;
  source: ProofSource;
}

export interface ProofMessageEvidence {
  messageId: string;
  subject: string;
  from: string;
  email: string;
  folder: string;
  senderRule: "allow" | "verify" | "block" | null;
  postageAmount: string | null;
  digest: string | null;
  contentCommitment: string | null;
  timestamp: string | null;
  senderVerified: boolean;
  signatureVerified: boolean;
  tampered: boolean;
}

export interface ProofEvidence {
  message: ProofMessageEvidence | null;
  postage: PostageRecord | null;
  receipt: ReceiptRecord | null;
  lifecycle: LifecycleAnchorRecord | null;
  policy: PolicyReconciliation | null;
  fetchedAt: string;
}

export type ProofEvidenceSource = "local" | "testnet";

export interface FetchProofEvidenceResult {
  /** `null` when the query matched no message in the mailbox. */
  evidence: ProofEvidence | null;
  source: ProofEvidenceSource;
}

/**
 * Minimal surface of the typed API the aggregator needs. The production path
 * passes `sharedTypedApi`; tests inject a fake adapter, keeping demo fixtures
 * out of the production code path.
 */
export interface ProofEvidenceApi {
  postage: { get(messageId: string, signal?: AbortSignal): Promise<PostageRecord> };
  receipts: { get(messageId: string, signal?: AbortSignal): Promise<ReceiptRecord> };
  lifecycle: { get(messageId: string, signal?: AbortSignal): Promise<LifecycleAnchorRecord> };
  policies: {
    getReconciliation(
      owner: string,
      chainVersion?: number,
      signal?: AbortSignal,
    ): Promise<PolicyReconciliation>;
  };
}

export function stellarExpertUrl(identifier: string, kind: "tx" | "contract"): string {
  return `https://stellar.expert/explorer/testnet/${kind}/${identifier}`;
}

/** Resolve a proof query against real mailbox messages (message + storage). */
export function resolveEmailForQuery(emails: Email[], query: string): Email | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    emails.find((email) => {
      if (email.id.toLowerCase().includes(q)) return true;
      if (email.from.toLowerCase().includes(q)) return true;
      if (email.email.toLowerCase().includes(q)) return true;
      if (email.subject.toLowerCase().includes(q)) return true;
      if (email.provenanceData?.digest?.toLowerCase().includes(q)) return true;
      if (email.provenanceData?.contentCommitment?.toLowerCase().includes(q)) return true;
      return false;
    }) ?? null
  );
}

/** Build the message/storage evidence block for a real email. */
export function buildMessageEvidence(email: Email): ProofMessageEvidence {
  const tampered =
    email.quarantineRecord?.reasonCode === "integrity_error" ||
    email.quarantineRecord?.reasonCode === "signature_error" ||
    email.encryptedPayload?.status === "failed";
  return {
    messageId: email.id,
    subject: email.subject,
    from: email.from,
    email: email.email,
    folder: email.folder,
    senderRule: email.senderPolicy ?? null,
    postageAmount: email.postageAmount ?? null,
    digest: email.provenanceData?.digest ?? null,
    contentCommitment: email.provenanceData?.contentCommitment ?? null,
    timestamp: email.provenanceData?.timestamp ?? email.time ?? null,
    senderVerified: email.provenanceData?.senderVerified ?? false,
    signatureVerified: email.provenanceData?.signatureVerified ?? false,
    tampered,
  };
}

async function safeFetch<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export interface FetchProofEvidenceOptions {
  query: string;
  emails: Email[];
  api: ProofEvidenceApi;
  /** Current mailbox owner (recipient) used to detect conflicting evidence. */
  owner?: string | null;
  signal?: AbortSignal;
  /** When true (demo mode / signed out) no network evidence is attempted. */
  offline?: boolean;
}

/**
 * Fetch real proof evidence for a query. Returns `{ evidence: null }` when no
 * message matches, local-only evidence when offline, and full message +
 * storage + testnet evidence otherwise. Missing testnet records surface as
 * `null` (shown as missing) while transport failures are thrown for the UI to
 * present with a retry.
 */
export async function fetchProofEvidence(
  options: FetchProofEvidenceOptions,
): Promise<FetchProofEvidenceResult> {
  const email = resolveEmailForQuery(options.emails, options.query);
  if (!email) {
    return { evidence: null, source: "local" };
  }

  const message = buildMessageEvidence(email);
  const offline = options.offline === true || !options.owner;

  if (offline) {
    return {
      evidence: {
        message,
        postage: null,
        receipt: null,
        lifecycle: null,
        policy: null,
        fetchedAt: new Date().toISOString(),
      },
      source: "local",
    };
  }

  const [postage, receipt, lifecycle, policy] = await Promise.all([
    safeFetch(() => options.api.postage.get(message.messageId, options.signal)),
    safeFetch(() => options.api.receipts.get(message.messageId, options.signal)),
    safeFetch(() => options.api.lifecycle.get(message.messageId, options.signal)),
    safeFetch(() =>
      options.api.policies.getReconciliation(options.owner!, undefined, options.signal),
    ),
  ]);

  return {
    evidence: {
      message,
      postage,
      receipt,
      lifecycle,
      policy,
      fetchedAt: new Date().toISOString(),
    },
    source: "testnet",
  };
}

function participantsConflict(
  message: ProofMessageEvidence,
  owner: string | null | undefined,
  actual: string,
): boolean {
  return Boolean(owner) && actual !== owner;
}

function classifyPostage(evidence: ProofEvidence, owner?: string | null): ProofCheck {
  const message = evidence.message!;
  const postage = evidence.postage;
  const base = {
    key: "postage",
    label: "Postage escrow",
    source: "testnet" as const,
  };

  if (!postage) {
    return {
      ...base,
      state: "missing",
      detail: "No postage record was found on testnet for this message.",
    };
  }

  if (participantsConflict(message, owner, postage.recipient)) {
    return {
      ...base,
      state: "mismatched",
      detail: "Postage recipient does not match the current mailbox owner.",
      copyable: postage.paymentHash,
      explorerUrl: stellarExpertUrl(postage.paymentHash, "tx"),
    };
  }

  const settledStates: Record<string, ProofCheckState> = {
    settled: "verified",
    refunded: "verified",
    reclaimed: "verified",
    pending: "pending",
    expired: "pending",
    disputed: "mismatched",
  };

  return {
    ...base,
    state: settledStates[postage.status] ?? "pending",
    detail:
      postage.status === "settled"
        ? "Postage escrow was settled on testnet."
        : postage.status === "refunded"
          ? "Postage escrow was refunded to the sender."
          : postage.status === "reclaimed"
            ? "Postage escrow was reclaimed."
            : postage.status === "disputed"
              ? "Postage escrow is under dispute."
              : postage.status === "expired"
                ? "Postage escrow expired and awaits settlement."
                : "Postage escrow is pending settlement.",
    copyable: postage.paymentHash,
    explorerUrl: stellarExpertUrl(postage.paymentHash, "tx"),
  };
}

function classifyReceipt(evidence: ProofEvidence, owner?: string | null): ProofCheck {
  const message = evidence.message!;
  const receipt = evidence.receipt;
  const base = {
    key: "receipt",
    label: "Delivery & read receipt",
    source: "testnet" as const,
  };

  if (!receipt) {
    return {
      ...base,
      state: "missing",
      detail: "No delivery or read receipt was found on testnet for this message.",
    };
  }

  if (participantsConflict(message, owner, receipt.recipient)) {
    return {
      ...base,
      state: "mismatched",
      detail: "Receipt recipient does not match the current mailbox owner.",
      copyable: receipt.txHash ?? undefined,
      explorerUrl: receipt.txHash ? stellarExpertUrl(receipt.txHash, "tx") : undefined,
    };
  }

  if (receipt.chainStatus === "failed") {
    return {
      ...base,
      state: "mismatched",
      detail: "The receipt contract reports a failed confirmation on testnet.",
      copyable: receipt.txHash ?? undefined,
      explorerUrl: receipt.txHash ? stellarExpertUrl(receipt.txHash, "tx") : undefined,
    };
  }

  const confirmed = receipt.readAt !== null && receipt.chainStatus !== "pending";
  return {
    ...base,
    state: confirmed ? "verified" : "pending",
    detail: confirmed
      ? "Delivery and read receipt confirmed on testnet."
      : receipt.readAt !== null
        ? "Delivery receipt confirmed; read receipt recorded."
        : "Message delivered; read confirmation pending on testnet.",
    copyable: receipt.txHash ?? undefined,
    explorerUrl: receipt.txHash ? stellarExpertUrl(receipt.txHash, "tx") : undefined,
  };
}

function classifyLifecycle(evidence: ProofEvidence, owner?: string | null): ProofCheck {
  const message = evidence.message!;
  const lifecycle = evidence.lifecycle;
  const base = {
    key: "lifecycle",
    label: "Lifecycle anchor",
    source: "testnet" as const,
  };

  if (!lifecycle) {
    return {
      ...base,
      state: "missing",
      detail: "No lifecycle anchor was found on testnet for this message.",
    };
  }

  if (participantsConflict(message, owner, lifecycle.recipient)) {
    return {
      ...base,
      state: "mismatched",
      detail: "Lifecycle anchor recipient does not match the current mailbox owner.",
      copyable: lifecycle.txHash ?? undefined,
      explorerUrl: lifecycle.txHash ? stellarExpertUrl(lifecycle.txHash, "tx") : undefined,
    };
  }

  if (lifecycle.status === "failed") {
    return {
      ...base,
      state: "mismatched",
      detail: "The lifecycle anchor failed to commit to testnet.",
      copyable: lifecycle.txHash ?? undefined,
      explorerUrl: lifecycle.txHash ? stellarExpertUrl(lifecycle.txHash, "tx") : undefined,
    };
  }

  const confirmed = lifecycle.status === "confirmed";
  return {
    ...base,
    state: confirmed ? "verified" : "pending",
    detail: confirmed
      ? "Message lifecycle anchor confirmed on testnet."
      : "Message lifecycle anchor is pending confirmation on testnet.",
    copyable: lifecycle.txHash ?? undefined,
    explorerUrl: lifecycle.txHash ? stellarExpertUrl(lifecycle.txHash, "tx") : undefined,
  };
}

function classifyPolicy(evidence: ProofEvidence): ProofCheck {
  const policy = evidence.policy;
  const base = {
    key: "policy",
    label: "Mailbox policy version",
    source: "testnet" as const,
  };

  if (!policy) {
    return {
      ...base,
      state: "missing",
      detail: "No policy reconciliation is available for this mailbox.",
    };
  }

  let state: ProofCheckState;
  let detail: string;
  switch (policy.state) {
    case "synced":
    case "chain_ahead":
      state = "verified";
      detail = policy.chain.policy
        ? "Mailbox policy matches the on-chain testnet policy version."
        : "Mailbox policy state is in sync on testnet.";
      break;
    case "pending_write":
      state = "pending";
      detail = "A policy update is queued and pending write to testnet.";
      break;
    case "not_provisioned":
      state = "pending";
      detail = "The mailbox policy has not been provisioned to testnet yet.";
      break;
    case "diverged":
      state = "mismatched";
      detail = "The off-chain and on-chain policy versions have diverged.";
      break;
    case "failed":
      state = "mismatched";
      detail = "The last policy write to testnet failed.";
      break;
    default:
      state = "missing";
      detail = "Policy reconciliation state is unknown.";
  }

  return { ...base, state, detail };
}

/**
 * Classify every proof piece into verified / pending / missing / mismatched /
 * tampered. Pure — no network, so unit tests feed deterministic fixtures.
 */
export function classifyProofEvidence(
  evidence: ProofEvidence,
  owner?: string | null,
): ProofCheck[] {
  if (!evidence.message) return [];

  const checks: ProofCheck[] = [];
  const message = evidence.message;

  checks.push({
    key: "message-hash",
    label: "Message integrity hash",
    state: message.tampered ? "tampered" : message.digest ? "verified" : "missing",
    detail: message.tampered
      ? "Decryption or integrity verification failed — the payload may have been tampered in transit."
      : message.digest
        ? "SHA-256 digest verified from the decrypted envelope."
        : "No message digest is recorded for this message.",
    copyable: message.digest ?? undefined,
    source: "message",
  });

  checks.push({
    key: "content-commitment",
    label: "Envelope content commitment",
    state: message.tampered ? "tampered" : message.contentCommitment ? "verified" : "missing",
    detail: message.tampered
      ? "The envelope commitment could not be verified against the ciphertext."
      : message.contentCommitment
        ? "The encrypted payload commitment is recorded for this message."
        : "No envelope commitment was found for this message.",
    copyable: message.contentCommitment ?? undefined,
    source: "message",
  });

  const senderVerified = message.senderVerified || message.signatureVerified;
  checks.push({
    key: "sender-identity",
    label: "Sender identity",
    state: message.tampered ? "tampered" : senderVerified ? "verified" : "missing",
    detail: senderVerified
      ? "Sender signature was verified (Ed25519) against the resolved Stellar key."
      : message.senderRule === "block"
        ? "The sender is blocked by the mailbox policy."
        : "Sender authenticity is not verified for this message.",
    copyable: message.email,
    source: "message",
  });

  checks.push(classifyPostage(evidence, owner));
  checks.push(classifyReceipt(evidence, owner));
  checks.push(classifyLifecycle(evidence, owner));
  checks.push(classifyPolicy(evidence));

  return checks;
}

export type ProofVerdictState = "verified" | "pending" | "conflict" | "tampered" | "incomplete";

export interface ProofVerdict {
  state: ProofVerdictState;
  label: string;
  detail: string;
}

/** Collapse per-check classifications into a single honest verdict. */
export function proofVerdict(checks: ProofCheck[]): ProofVerdict {
  if (checks.some((check) => check.state === "tampered")) {
    return {
      state: "tampered",
      label: "Tampered",
      detail: "One or more proofs failed integrity verification.",
    };
  }
  if (checks.some((check) => check.state === "mismatched")) {
    return {
      state: "conflict",
      label: "Evidence Conflict",
      detail: "Conflicting testnet evidence was detected for this message.",
    };
  }
  if (checks.length > 0 && checks.every((check) => check.state === "verified")) {
    return {
      state: "verified",
      label: "Ledger Verified",
      detail: "Every recorded proof was verified against message, storage and testnet evidence.",
    };
  }
  if (checks.some((check) => check.state === "pending")) {
    return {
      state: "pending",
      label: "Pending",
      detail: "Some proofs are still pending settlement or confirmation.",
    };
  }
  return {
    state: "incomplete",
    label: "Incomplete",
    detail: "Some proofs have no recorded evidence on testnet.",
  };
}
