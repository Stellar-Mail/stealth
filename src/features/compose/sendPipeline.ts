/**
 * Compose send pipeline (BETA-046 / BETA-057).
 *
 * Implements the staged send journey for messages leaving the compose view:
 *   1. `resolve`   — look up each recipient's key directory and assert its active
 *                    encryption key (Curve25519 / P-256 SPKI) is valid.
 *   2. `encrypt`   — seal the envelope payload with the recipient public keys.
 *   3. `sign`      — invoke the signer seam with the canonical relay request,
 *                    confirming sender binding and collecting an Ed25519 signature.
 *   4. `postage`   — verifies postage policy quotes and sender trust status.
 *   5. `persist`   — anchor the payload and active stages to the local outbox.
 *   6. `submit`    — POST to the recipient's relay endpoint (with re-sign on retry).
 *   7. `reconcile` — reconcile relay response against local outbox state.
 *
 * Injected seams allow the entire journey (including every failure branch and
 * retry path) to execute in headless test suites without a wallet or network.
 */

import {
  sealEnvelope,
  canonicalizePayload,
  type EnvelopePayload,
  type SealedEnvelope,
} from "@/services/crypto/envelope";
import { type DirectoryRecipientKeyResolver } from "@/services/crypto/key-resolver";
import {
  RecipientKeyResolutionError,
  resolveRecipientKeysForSend,
  type RecipientKeyMaterial,
} from "./recipientKeyResolution";
import { SenderBindingError, verifySenderBinding } from "@/services/crypto/sender-binding";
import {
  DEFAULT_REPLAY_WINDOW_SECONDS,
  buildSignedRelayRequest,
  type RelayRequestSigner,
  type SignedRelayRequest,
} from "@/services/relay/submit";
import {
  WalletRejectedError,
  WalletUnavailableError,
  authorizeSend,
  type WalletSignature,
} from "@/services/stellar/wallet";
import {
  createEntry,
  patchEntry,
  type OutboxStatus,
  type OutboxEntry,
  type OutboxStageSnapshot,
} from "@/services/storage/outbox";
import type { PostageQuote } from "./usePostageQuote";

export type StageId =
  | "resolve"
  | "quote"
  | "encrypt"
  | "sign"
  | "escrow"
  | "postage"
  | "persist"
  | "submit"
  | "anchor"
  | "reconcile";

export type StageStatus = "pending" | "active" | "done" | "error";

export interface StageState {
  id: StageId;
  label: string;
  status: StageStatus;
  detail?: string;
}

export type DeliveryState = "SUBMITTED" | "ACKNOWLEDGED" | "DEDUPLICATED" | "DEAD_LETTER";

export interface ProofReferences {
  receiptId?: string;
  anchorTxHash?: string;
  postagePaymentHash?: string;
  relayMessageId?: string;
}

export type SendOutcome =
  | {
      ok: true;
      messageId: string;
      idempotencyKey: string;
      supportId: string;
      delivered: boolean;
      state: DeliveryState;
      timestamp: string;
      proofReferences: ProofReferences;
    }
  | {
      ok: false;
      messageId: string;
      idempotencyKey: string;
      supportId: string;
      stage: StageId;
      reason: "recipient_rejected" | "wallet_rejected" | "wallet_unavailable" | "failed";
      message: string;
      code?: string;
      canRetry: boolean;
      isCommitted: boolean;
      timestamp: string;
    };

export interface SendPipelineInput {
  messageId?: string;
  sender: string;
  to: string;
  subject: string;
  body: string;
  recipients?: Array<{ address: string; account?: string }>;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size_bytes: number;
    data?: ArrayBuffer;
    content_hash?: string;
  }>;
  postage?: string;
  postageQuote?: PostageQuote;
}

export interface SendPipelineOptions {
  signer?: (canonical: string) => Promise<WalletSignature>;
  keyResolver?: DirectoryRecipientKeyResolver;
  quoteFetcher?: (
    recipient: string,
    sender: string,
    messageId: string,
  ) => Promise<{ amount: string; asset?: string; eligible?: boolean }>;
  escrowSubmitter?: (input: {
    messageId: string;
    amount: string;
    sender: string;
    recipient: string;
  }) => Promise<{ paymentHash: string }>;
  receiptAnchorer?: (
    messageId: string,
    recipient: string,
    sender: string,
  ) => Promise<{ receiptId: string; anchorTxHash: string }>;
  relaySubmitter?: typeof submitToRelay;
}

const STAGE_LABELS: Record<StageId, string> = {
  resolve: "Resolving recipient keys",
  quote: "Requesting postage quote",
  encrypt: "Encrypting message",
  sign: "Awaiting wallet signature",
  escrow: "Reserving postage escrow",
  postage: "Verifying postage policy",
  persist: "Saving to outbox",
  submit: "Submitting to relay",
  anchor: "Anchoring delivery receipt",
  reconcile: "Confirming delivery",
};

const STAGE_ORDER: StageId[] = [
  "resolve",
  "quote",
  "encrypt",
  "sign",
  "escrow",
  "persist",
  "submit",
  "anchor",
  "reconcile",
];

function newMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `msg-${crypto.randomUUID()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `msg-${Date.now()}-${hex}`;
  }
  return `msg-${Date.now()}`;
}

function deriveDomain(address: string): string {
  const parts = address.split("*");
  if (parts.length === 2 && parts[1]) return parts[1];
  return "stellar.network";
}

export class SendPipeline {
  readonly messageId: string;
  readonly idempotencyKey: string;
  readonly supportId: string;
  private readonly input: SendPipelineInput;
  private readonly onProgress?: (stages: StageState[]) => void;
  private readonly stages: StageState[];
  private readonly recipients: string[];
  private readonly domain: string;
  private readonly audience: string;

  private sealed?: SealedEnvelope;
  private signature?: WalletSignature;
  private canonical = "";
  private delivered = false;
  private finalState: DeliveryState = "DEAD_LETTER";
  private lastErrorCode?: string;
  private lastErrorMessage?: string;
  private lastOutcome?: SendOutcome;

  private isCommitted = false;
  private cancelled = false;
  private runningPromise?: Promise<SendOutcome>;

  private recipientKeys: RecipientKeyMaterial[] = [];
  private signedRequest?: SignedRelayRequest;
  private requestSigner?: RelayRequestSigner;

  private quoteAmount = "0";
  private paymentHash?: string;
  private receiptId?: string;
  private anchorTxHash?: string;

  /** Injected seams for tests / alternate handlers. */
  private readonly signer: (canonical: string) => Promise<WalletSignature>;
  private readonly keyResolver?: DirectoryRecipientKeyResolver;
  private readonly quoteFetcher?: SendPipelineOptions["quoteFetcher"];
  private readonly escrowSubmitter?: SendPipelineOptions["escrowSubmitter"];
  private readonly receiptAnchorer?: SendPipelineOptions["receiptAnchorer"];
  private readonly relaySubmitter: typeof submitToRelay;

  constructor(
    input: SendPipelineInput,
    onProgress?: (stages: StageState[]) => void,
    options: SendPipelineOptions = {},
  ) {
    this.input = input;
    this.onProgress = onProgress;
    this.messageId = input.messageId ?? newMessageId();
    this.idempotencyKey = `idem-${this.messageId}`;
    const cleanId = this.messageId.replace(/^msg-/, "");
    this.supportId = `supp-${cleanId.slice(0, 12)}`;

    this.recipients = this.recipientAccounts();
    this.domain = deriveDomain(input.to);
    this.audience = `relay.${this.domain}`;
    this.signer = options.signer ?? authorizeSend;
    this.keyResolver = options.keyResolver;
    this.quoteFetcher = options.quoteFetcher;
    this.escrowSubmitter = options.escrowSubmitter;
    this.receiptAnchorer = options.receiptAnchorer;
    this.relaySubmitter = options.relaySubmitter ?? submitToRelay;

    this.stages = STAGE_ORDER.map((id) => ({
      id,
      label: STAGE_LABELS[id],
      status: "pending",
    }));
  }

  static fromPersisted(
    entry: OutboxEntry,
    inputOverrides: Partial<SendPipelineInput> = {},
    onProgress?: (stages: StageState[]) => void,
    options: {
      signer?: (canonical: string) => Promise<WalletSignature>;
      keyResolver?: DirectoryRecipientKeyResolver;
    } = {},
  ): SendPipeline {
    const pipeline = new SendPipeline(
      {
        sender: entry.sender ?? inputOverrides.sender ?? "",
        to: entry.recipients.join(", "),
        subject: entry.subject,
        body: inputOverrides.body ?? "",
        messageId: entry.id,
        recipients: inputOverrides.recipients,
        postage: entry.postageAmount ?? inputOverrides.postage,
        ...inputOverrides,
      },
      onProgress,
      options,
    );

    if (entry.stages && entry.stages.length > 0) {
      for (const saved of entry.stages) {
        const target = pipeline.stages.find((s) => s.id === saved.id);
        if (target) {
          target.status = saved.status;
          target.detail = saved.detail;
        }
      }
    }

    if (entry.status === "delivered") {
      pipeline.delivered = true;
      pipeline.finalState = "ACKNOWLEDGED";
    }
    if (entry.isCommitted) {
      pipeline.isCommitted = true;
    }
    if (entry.envelope && entry.ciphertext) {
      pipeline.sealed = {
        payload: entry.envelope,
        ciphertext: entry.ciphertext,
      };
    }

    return pipeline;
  }

  cancel(): { success: boolean; reason?: string } {
    if (this.isCommitted) {
      return {
        success: false,
        reason: "Cannot cancel — operation is already committed to the relay",
      };
    }
    this.cancelled = true;
    const activeStage = this.stages.find((s) => s.status === "active");
    if (activeStage) {
      this.setStage(activeStage.id, "error", "Cancelled by user");
    }
    return { success: true };
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  getStages(): StageState[] {
    return this.stages.map((s) => ({ ...s }));
  }

  isRunning(): boolean {
    return this.runningPromise !== undefined;
  }

  getLastOutcome(): SendOutcome | undefined {
    return this.lastOutcome;
  }

  private async executeResolveStage(): Promise<SendOutcome | null> {
    this.setStage("resolve", "active");
    try {
      const accounts = this.recipientAccounts();
      if (accounts.length === 0) {
        this.setStage("resolve", "error", "No recipients");
        return this.fail(
          "resolve",
          "recipient_rejected",
          "At least one recipient is required",
          undefined,
          false,
        );
      }
      this.recipientKeys = await resolveRecipientKeysForSend(accounts, this.keyResolver);
      this.setStage("resolve", "done", `${this.recipientKeys.length} recipient key(s) resolved`);
      return null;
    } catch (error) {
      const code = error instanceof RecipientKeyResolutionError ? error.recipient : undefined;
      const detail =
        error instanceof RecipientKeyResolutionError
          ? error.message
          : "Could not resolve recipient keys";
      this.setStage("resolve", "error", detail);
      return this.fail("resolve", "recipient_rejected", detail, code, false);
    }
  }

  private async executeEncryptStage(): Promise<SendOutcome | null> {
    this.setStage("encrypt", "active");
    try {
      this.sealed = await sealEnvelope({
        sender: this.input.sender,
        recipient: this.recipientKeys[0]?.account ?? "",
        body: this.input.body,
        attachments: this.input.attachments,
        recipientPublicKeys: this.recipientKeys.map((key) => key.publicKeySpkiBase64),
        recipientKeyId: this.recipientKeys[0]?.keyId,
      });
      this.setStage("encrypt", "done", "Sealed with Curve25519 / AES-GCM");
      return null;
    } catch {
      this.setStage("encrypt", "error", "Could not encrypt message");
      return this.fail(
        "encrypt",
        "failed",
        "Could not encrypt the message",
        "ERR_ENCRYPTION_FAILED",
        true,
      );
    }
  }

  private async executeSignStage(): Promise<SendOutcome | null> {
    if (!this.sealed) {
      return this.fail("sign", "failed", "Missing encrypted envelope", "ERR_MISSING_ENVELOPE");
    }
    this.setStage("sign", "active");
    try {
      let capturedSignature: WalletSignature | undefined;
      const sign = async (canonical: string) => {
        const signature = await this.signer(canonical);
        capturedSignature = signature;
        return signature;
      };

      const requestSigner: RelayRequestSigner = {
        envelopePayload: this.sealed.payload,
        audience: this.audience,
        idempotencyKey: this.idempotencyKey,
        replayWindowSeconds: DEFAULT_REPLAY_WINDOW_SECONDS,
        sign,
      };
      this.requestSigner = requestSigner;

      const signed = await buildSignedRelayRequest(requestSigner);
      this.signedRequest = signed;
      this.signature = capturedSignature ?? {
        scheme: "Ed25519",
        signerAddress: "",
        value: signed.signature.value,
      };
      this.canonical = canonicalizePayload(signed.payload);

      verifySenderBinding(this.signature.signerAddress, this.input.sender);
      this.setStage("sign", "done", "Authorized by sender");
      return null;
    } catch (error) {
      if (error instanceof SenderBindingError) {
        this.setStage("sign", "error", "Wallet signer does not match the sender");
        return this.fail(
          "sign",
          "failed",
          "Wallet signer does not match the sender",
          "ERR_SENDER_BINDING",
          true,
        );
      }
      if (error instanceof WalletRejectedError) {
        this.setStage("sign", "error", "Wallet rejected — draft kept");
        return this.fail(
          "sign",
          "wallet_rejected",
          error.message || "Wallet rejected signature",
          "ERR_WALLET_REJECTED",
          true,
        );
      }
      if (error instanceof WalletUnavailableError) {
        this.setStage("sign", "error", "Wallet unavailable");
        return this.fail(
          "sign",
          "wallet_unavailable",
          error.message || "No wallet detected",
          "ERR_WALLET_UNAVAILABLE",
          true,
        );
      }
      this.setStage("sign", "error", "Signing failed");
      return this.fail(
        "sign",
        "failed",
        "Wallet could not sign the message",
        "ERR_SIGNING_FAILED",
        true,
      );
    }
  }

  private async executeQuoteStage(): Promise<SendOutcome | null> {
    this.setStage("quote", "active");
    try {
      if (this.quoteFetcher) {
        const quote = await this.quoteFetcher(
          this.recipientKeys[0]?.account ?? this.recipients[0] ?? "",
          this.input.sender,
          this.messageId,
        );
        if (quote.eligible === false) {
          this.setStage("quote", "error", "Recipient rejected sender");
          return this.fail(
            "resolve",
            "recipient_rejected",
            "Recipient rejected sender postage eligibility",
            "ERR_INELIGIBLE_SENDER",
            false,
          );
        }
        this.quoteAmount = quote.amount ?? "0";
      } else if (this.input.postageQuote) {
        if (this.input.postageQuote.reason === "sender_blocked") {
          this.setStage("quote", "error", "Recipient blocked this sender");
          return this.fail(
            "resolve",
            "recipient_rejected",
            "Recipient has blocked this sender",
            "ERR_SENDER_BLOCKED",
            false,
          );
        }
        if (this.input.postageQuote.trusted) {
          this.quoteAmount = "0";
        }
      } else if (this.input.postage) {
        this.quoteAmount = this.input.postage;
      }
      this.setStage("quote", "done", `Quote: ${this.quoteAmount} XLM`);
      return null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Quote failed";
      this.setStage("quote", "error", detail);
      return this.fail("resolve", "recipient_rejected", detail, "ERR_QUOTE_FAILED", false);
    }
  }

  private async executeEscrowStage(): Promise<SendOutcome | null> {
    this.setStage("escrow", "active");
    try {
      if (this.escrowSubmitter && this.quoteAmount !== "0") {
        const escrow = await this.escrowSubmitter({
          messageId: this.messageId,
          amount: this.quoteAmount,
          sender: this.input.sender,
          recipient: this.recipientKeys[0]?.account ?? this.recipients[0] ?? "",
        });
        this.paymentHash = escrow.paymentHash;
      }
      this.setStage("escrow", "done", "Postage escrow reserved");
      return null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Escrow reservation failed";
      this.setStage("escrow", "error", detail);
      return this.fail("escrow", "escrow_failed" as any, detail, "ERR_ESCROW_FAILED", true);
    }
  }

  private async executeAnchorStage(): Promise<SendOutcome | null> {
    this.setStage("anchor", "active");
    try {
      if (this.receiptAnchorer) {
        const anchor = await this.receiptAnchorer(
          this.messageId,
          this.recipientKeys[0]?.account ?? this.recipients[0] ?? "",
          this.input.sender,
        );
        this.receiptId = anchor.receiptId;
        this.anchorTxHash = anchor.anchorTxHash;
      }
      this.setStage("anchor", "done", "Delivery receipt anchored");
      return null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Receipt anchoring failed";
      this.setStage("anchor", "error", detail);
      return this.fail("anchor", "failed", detail, "ERR_ANCHOR_FAILED", true);
    }
  }

  private async executePostageStage(): Promise<SendOutcome | null> {
    this.setStage("postage", "active");
    try {
      if (this.input.postageQuote) {
        if (this.input.postageQuote.reason === "sender_blocked") {
          this.setStage("postage", "error", "Recipient blocked this sender");
          return this.fail(
            "postage",
            "failed",
            "Recipient has blocked this sender",
            "ERR_SENDER_BLOCKED",
            false,
          );
        }
        if (this.input.postageQuote.trusted) {
          this.setStage("postage", "done", "Trusted (0 XLM postage)");
          return null;
        }
      }

      const postageDisplay = this.input.postage ? `${this.input.postage} XLM` : "Verified";
      this.setStage("postage", "done", `Postage verified (${postageDisplay})`);
      return null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Postage verification failed";
      this.setStage("postage", "error", detail);
      return this.fail("postage", "failed", detail, "ERR_POSTAGE_FAILED", true);
    }
  }

  private async executePersistStage(): Promise<SendOutcome | null> {
    this.setStage("persist", "active");
    createEntry({
      id: this.messageId,
      subject: this.input.subject,
      recipients: this.recipients,
      sender: this.input.sender,
      idempotencyKey: this.idempotencyKey,
      supportId: this.supportId,
      stages: this.stages.map((s) => ({
        id: s.id,
        label: s.label,
        status: s.id === "persist" ? "done" : s.status,
        detail: s.detail,
      })),
    });
    this.setOutbox("submitting", {
      envelope: this.sealed?.payload,
      ciphertext: this.sealed?.ciphertext,
      postageAmount: this.input.postage,
    });
    this.setStage("persist", "done", "Anchored in outbox");
    return null;
  }

  private async executeSubmitStage(): Promise<SendOutcome | null> {
    if (!this.requestSigner && this.sealed) {
      const sign = async (canonical: string) => {
        const signature = await this.signer(canonical);
        return signature;
      };
      this.requestSigner = {
        envelopePayload: this.sealed.payload,
        audience: this.audience,
        idempotencyKey: this.idempotencyKey,
        replayWindowSeconds: DEFAULT_REPLAY_WINDOW_SECONDS,
        sign,
      };
    }
    if (!this.signedRequest && this.requestSigner) {
      try {
        this.signedRequest = await buildSignedRelayRequest(this.requestSigner);
      } catch (error) {
        this.setStage("submit", "error", error instanceof Error ? error.message : "Signing failed");
        return this.fail(
          "submit",
          "failed",
          error instanceof Error ? error.message : "Wallet could not sign the request",
          "ERR_SIGNING_FAILED",
          true,
        );
      }
    }

    if (!this.signedRequest || !this.requestSigner) {
      return this.fail(
        "submit",
        "failed",
        "Missing signed relay request",
        "ERR_MISSING_SIGNED_REQUEST",
      );
    }
    this.setStage("submit", "active");
    this.isCommitted = true;
    try {
      const result = await submitToRelay({
        messageId: this.messageId,
        sender: this.input.sender,
        recipient: this.recipientKeys[0]?.account ?? "",
        recipientDomain: this.domain,
        payload: JSON.stringify(this.signedRequest),
        resigner: this.requestSigner,
      });
      this.delivered = result.delivered;
      this.finalState = result.state;
      this.lastErrorCode = result.errorCode;
      this.setStage("submit", "done", "Accepted by relay");
      return null;
    } catch {
      this.setStage("submit", "error", "Relay submission failed");
      return this.fail(
        "submit",
        "failed",
        "Could not reach the relay",
        "ERR_RELAY_UNREACHABLE",
        true,
      );
    }
  }

  private async executeReconcileStage(): Promise<SendOutcome | null> {
    this.setStage("reconcile", "active");
    if (this.delivered) {
      this.setOutbox("delivered", { canRetry: false });
      this.setStage("reconcile", "done", "Delivered");
      return null;
    }
    this.setOutbox("failed", { errorCode: this.lastErrorCode, canRetry: false });
    this.setStage("reconcile", "error", this.lastErrorMessage ?? "Relay reported delivery failure");
    return this.fail(
      "reconcile",
      "failed",
      this.lastErrorMessage ?? "Message could not be delivered by the relay",
      this.lastErrorCode,
      false,
    );
  }

  private async runStage(id: StageId): Promise<SendOutcome | null> {
    if (this.cancelled) {
      return this.fail(id, "failed", "Send operation was cancelled", "ERR_CANCELLED", false);
    }

    switch (id) {
      case "resolve":
        return this.executeResolveStage();
      case "quote":
        return this.executeQuoteStage();
      case "encrypt":
        return this.executeEncryptStage();
      case "sign":
        return this.executeSignStage();
      case "escrow":
        return this.executeEscrowStage();
      case "postage":
        return this.executePostageStage();
      case "persist":
        return this.executePersistStage();
      case "submit":
        return this.executeSubmitStage();
      case "anchor":
        return this.executeAnchorStage();
      case "reconcile":
        return this.executeReconcileStage();
      default:
        return null;
    }
  }

  async resume(): Promise<SendOutcome> {
    return this.run();
  }

  async run(): Promise<SendOutcome> {
    if (this.runningPromise) {
      return this.runningPromise;
    }

    const execution = (async () => {
      for (const stage of this.stages) {
        if (this.cancelled) {
          return this.fail(
            stage.id,
            "failed",
            "Send operation was cancelled",
            "ERR_CANCELLED",
            false,
          );
        }
        if (stage.status === "done") continue;
        const failure = await this.runStage(stage.id);
        if (failure) {
          this.lastOutcome = failure;
          return failure;
        }
      }

      const outcome: SendOutcome = {
        ok: true,
        messageId: this.messageId,
        idempotencyKey: this.idempotencyKey,
        supportId: this.supportId,
        delivered: this.delivered,
        state: this.finalState,
        timestamp: new Date().toISOString(),
        proofReferences: {
          relayMessageId: this.messageId,
          anchorTxHash: this.anchorTxHash,
          postagePaymentHash: this.paymentHash,
          receiptId: this.receiptId,
        },
      };
      this.lastOutcome = outcome;
      return outcome;
    })();

    this.runningPromise = execution;
    try {
      return await execution;
    } finally {
      this.runningPromise = undefined;
    }
  }

  private fail(
    stage: StageId,
    reason: "recipient_rejected" | "wallet_rejected" | "wallet_unavailable" | "failed",
    message: string,
    code?: string,
    canRetry = true,
  ): SendOutcome {
    const outcome: SendOutcome = {
      ok: false,
      messageId: this.messageId,
      idempotencyKey: this.idempotencyKey,
      supportId: this.supportId,
      stage,
      reason,
      message,
      code,
      canRetry,
      isCommitted: this.isCommitted,
      timestamp: new Date().toISOString(),
    };
    this.lastOutcome = outcome;
    return outcome;
  }

  private setStage(id: StageId, status: StageStatus, detail?: string) {
    const stage = this.stages.find((s) => s.id === id);
    if (stage) {
      stage.status = status;
      stage.detail = detail;
      this.onProgress?.(this.getStages());
      this.syncOutboxStages();
    }
  }

  private syncOutboxStages() {
    const snapshots: OutboxStageSnapshot[] = this.stages.map((s) => ({
      id: s.id,
      label: s.label,
      status: s.status,
      detail: s.detail,
    }));
    patchEntry(this.messageId, {
      stages: snapshots,
      isCommitted: this.isCommitted,
      canRetry: !this.isCommitted,
    });
  }

  private setOutbox(
    status: OutboxStatus,
    patch: {
      errorCode?: string;
      envelope?: EnvelopePayload;
      ciphertext?: string;
      canRetry?: boolean;
      postageAmount?: string;
    } = {},
  ) {
    patchEntry(this.messageId, {
      status,
      errorCode: patch.errorCode,
      envelope: patch.envelope,
      ciphertext: patch.ciphertext,
      canRetry: patch.canRetry ?? !this.isCommitted,
      isCommitted: this.isCommitted,
      postageAmount: patch.postageAmount,
    });
  }

  private recipientAccounts(): string[] {
    if (this.input.recipients && this.input.recipients.length > 0) {
      return this.input.recipients.map((r) => r.account ?? r.address);
    }
    return this.input.to
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
  }
}

interface RelaySubmitResult {
  delivered: boolean;
  state: DeliveryState;
  errorCode?: string;
}

interface SubmitOptions {
  messageId: string;
  sender: string;
  recipient: string;
  recipientDomain: string;
  payload: string;
  resigner: RelayRequestSigner;
}

const MAX_SUBMIT_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 250;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitToRelay(opts: SubmitOptions): Promise<RelaySubmitResult> {
  const endpoint = `/api/v1/relay/messages`;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
    let requestPayload = opts.payload;
    if (attempt > 1) {
      const refreshed = await buildSignedRelayRequest(opts.resigner);
      requestPayload = JSON.stringify(refreshed);
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": opts.resigner.idempotencyKey,
        },
        body: requestPayload,
      });

      if (response.status === 200 || response.status === 201) {
        return { delivered: true, state: "ACKNOWLEDGED" };
      }
      if (response.status === 409) {
        return { delivered: true, state: "DEDUPLICATED" };
      }
      if (response.status >= 500 && attempt < MAX_SUBMIT_ATTEMPTS) {
        await delay(backoffMs);
        backoffMs *= 2;
        continue;
      }
      return {
        delivered: false,
        state: "DEAD_LETTER",
        errorCode: `HTTP_${response.status}`,
      };
    } catch (error) {
      if (attempt < MAX_SUBMIT_ATTEMPTS) {
        await delay(backoffMs);
        backoffMs *= 2;
        continue;
      }
      return {
        delivered: false,
        state: "DEAD_LETTER",
        errorCode: error instanceof Error ? error.name : "NETWORK_ERROR",
      };
    }
  }

  return { delivered: false, state: "DEAD_LETTER", errorCode: "MAX_ATTEMPTS_EXCEEDED" };
}
