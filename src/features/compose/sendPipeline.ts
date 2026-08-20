/**
 * Compose send pipeline (BETA-048 / #1954).
 *
 * Orchestrates the staged versioned send workflow:
 * resolve -> quote -> encrypt -> sign -> escrow -> persist -> submit -> anchor -> reconcile.
 *
 * Each stage reports progress and can be resumed/retried cleanly. Completed stages
 * are skipped. Wallet rejections or boundary failures stop cleanly without double-charging
 * or creating duplicate escrows/messages.
 */
import { canonicalizePayload, sealEnvelope, type SealedEnvelope } from "@/services/crypto/envelope";
import {
  authorizeSend,
  WalletRejectedError,
  WalletUnavailableError,
  type WalletSignature,
} from "@/services/stellar/wallet";
import { createEntry, patchEntry, type OutboxStatus } from "@/services/storage/outbox";
import {
  submitToRelay,
  buildSignedRelayRequest,
  DEFAULT_RELAY_AUDIENCE,
  DEFAULT_REPLAY_WINDOW_SECONDS,
  type RelayRequestSigner,
  type SignedRelayRequest,
} from "@/services/relay/submit";
import {
  resolveRecipientKeysForSend,
  RecipientKeyResolutionError,
  type RecipientKeyMaterial,
} from "@/features/compose/recipientKeyResolution";
import { verifySenderBinding, SenderBindingError } from "@/services/crypto/sender-binding";
import { parseRecipients } from "@/components/mail/composeValidation";
import type { DeliveryState } from "@/services/relay/federation";
import type { DirectoryRecipientKeyResolver } from "@/services/crypto/key-resolver";

export type StageId =
  | "resolve"
  | "quote"
  | "encrypt"
  | "sign"
  | "escrow"
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

export type SendFailureReason =
  | "recipient_rejected"
  | "quote_rejected"
  | "wallet_rejected"
  | "wallet_unavailable"
  | "escrow_failed"
  | "relay_rejected"
  | "anchor_failed"
  | "failed";

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
      delivered: boolean;
      state: DeliveryState;
      version: number;
      proofReferences: ProofReferences;
      stages: StageState[];
    }
  | {
      ok: false;
      messageId: string;
      stage: StageId;
      reason: SendFailureReason;
      message: string;
      code?: string;
      version: number;
      stages: StageState[];
    };

/** A recipient as resolved by the compose UI before submission. */
export interface SendPipelineRecipient {
  /** The address the user entered (e.g. `alice*stellar.org`). */
  address: string;
  /** The canonical Stellar G-address the address resolved to. */
  account: string;
}

export interface SendPipelineInput {
  sender: string;
  to: string;
  subject: string;
  body: string;
  messageId?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size_bytes: number;
    data?: ArrayBuffer;
  }>;
  /** Pre-resolved recipient accounts from the compose UI. */
  recipients?: SendPipelineRecipient[];
  /** Relay authority id (defaults to the beta relay audience). */
  audience?: string;
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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `msg-${crypto.randomUUID()}`;
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deriveDomain(address: string): string {
  const parts = address.split("*");
  if (parts.length === 2 && parts[1]) return parts[1];
  return "stellar.network";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SendPipeline {
  readonly messageId: string;
  readonly version = 1;
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
    this.recipients = parseRecipients(input.to);
    this.domain = deriveDomain(this.recipients[0] ?? "");
    this.audience = input.audience ?? DEFAULT_RELAY_AUDIENCE;
    this.signer = options.signer ?? authorizeSend;
    this.keyResolver = options.keyResolver;
    this.quoteFetcher = options.quoteFetcher;
    this.escrowSubmitter = options.escrowSubmitter;
    this.receiptAnchorer = options.receiptAnchorer;
    this.relaySubmitter = options.relaySubmitter ?? submitToRelay;

    this.stages = STAGE_ORDER.map((id) => ({
      id,
      label: STAGE_LABELS[id],
      status: "pending" as StageStatus,
    }));
  }

  getStages(): StageState[] {
    return this.stages.map((stage) => ({ ...stage }));
  }

  getProofReferences(): ProofReferences {
    return {
      receiptId: this.receiptId,
      anchorTxHash: this.anchorTxHash,
      postagePaymentHash: this.paymentHash,
      relayMessageId: this.messageId,
    };
  }

  private setStage(id: StageId, status: StageStatus, detail?: string): void {
    const stage = this.stages.find((item) => item.id === id);
    if (stage) {
      stage.status = status;
      stage.detail = detail;
    }
    this.onProgress?.(this.getStages());
  }

  private setOutbox(status: OutboxStatus, extra: Record<string, unknown> = {}): void {
    patchEntry(this.messageId, { status, ...extra });
  }

  private fail(
    stage: StageId,
    reason: SendFailureReason,
    message: string,
    code?: string,
  ): SendOutcome {
    return {
      ok: false,
      messageId: this.messageId,
      stage,
      reason,
      message,
      ...(code ? { code } : {}),
      version: this.version,
      stages: this.getStages(),
    };
  }

  private recipientAccounts(): string[] {
    if (this.input.recipients && this.input.recipients.length > 0) {
      return this.input.recipients.map((recipient) => recipient.account);
    }
    return this.recipients;
  }

  private async runStage(id: StageId): Promise<SendOutcome | null> {
    switch (id) {
      case "resolve": {
        this.setStage("resolve", "active");
        try {
          const accounts = this.recipientAccounts();
          if (accounts.length === 0) {
            this.setStage("resolve", "error", "No recipients");
            return this.fail("resolve", "recipient_rejected", "At least one recipient is required");
          }
          this.recipientKeys = await resolveRecipientKeysForSend(accounts, this.keyResolver);
          this.setStage(
            "resolve",
            "done",
            `${this.recipientKeys.length} recipient key(s) resolved`,
          );
          return null;
        } catch (error) {
          const code = error instanceof RecipientKeyResolutionError ? error.recipient : undefined;
          const detail =
            error instanceof RecipientKeyResolutionError
              ? error.message
              : "Could not resolve recipient keys";
          this.setStage("resolve", "error", detail);
          return this.fail("resolve", "recipient_rejected", detail, code);
        }
      }
      case "quote": {
        this.setStage("quote", "active");
        try {
          const recipient = this.recipientAccounts()[0] ?? "";
          if (this.quoteFetcher) {
            const res = await this.quoteFetcher(recipient, this.input.sender, this.messageId);
            if (res.eligible === false) {
              this.setStage("quote", "error", "Recipient policy rejected sender");
              return this.fail("quote", "quote_rejected", "Recipient policy rejected sender");
            }
            this.quoteAmount = res.amount ?? "0";
          } else {
            this.quoteAmount = "0";
          }
          this.setStage("quote", "done", `Quote: ${this.quoteAmount} stroops`);
          return null;
        } catch {
          this.setStage("quote", "error", "Failed to obtain quote");
          return this.fail("quote", "quote_rejected", "Could not obtain postage quote");
        }
      }
      case "encrypt": {
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
          this.setStage("encrypt", "done");
          return null;
        } catch {
          this.setStage("encrypt", "error", "Could not encrypt message");
          return this.fail("encrypt", "failed", "Could not encrypt the message");
        }
      }
      case "sign": {
        if (!this.sealed) {
          return this.fail("sign", "failed", "Missing encrypted envelope");
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
            idempotencyKey: `idem-${this.messageId}`,
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
          this.setStage("sign", "done");
          return null;
        } catch (error) {
          if (error instanceof SenderBindingError) {
            this.setStage("sign", "error", "Wallet signer does not match the sender");
            return this.fail("sign", "failed", "Wallet signer does not match the sender");
          }
          if (error instanceof WalletRejectedError) {
            this.setStage("sign", "error", "Wallet rejected — draft kept");
            return this.fail("sign", "wallet_rejected", error.message);
          }
          if (error instanceof WalletUnavailableError) {
            this.setStage("sign", "error", "Wallet unavailable");
            return this.fail("sign", "wallet_unavailable", error.message);
          }
          this.setStage("sign", "error", "Signing failed");
          return this.fail("sign", "failed", "Wallet could not sign the message");
        }
      }
      case "escrow": {
        this.setStage("escrow", "active");
        try {
          if (this.escrowSubmitter) {
            const res = await this.escrowSubmitter({
              messageId: this.messageId,
              amount: this.quoteAmount,
              sender: this.input.sender,
              recipient: this.recipientKeys[0]?.account ?? "",
            });
            this.paymentHash = res.paymentHash;
          } else {
            await delay(100);
            this.paymentHash = `pay-${this.messageId.slice(0, 16)}`;
          }
          this.setStage("escrow", "done", `Escrow reserved (${this.paymentHash})`);
          return null;
        } catch {
          this.setStage("escrow", "error", "Postage escrow failed");
          return this.fail("escrow", "escrow_failed", "Could not reserve postage escrow");
        }
      }
      case "persist": {
        this.setStage("persist", "active");
        createEntry({
          id: this.messageId,
          subject: this.input.subject,
          recipients: this.recipients,
        });
        this.setOutbox("submitting", {
          envelope: this.sealed?.payload,
          ciphertext: this.sealed?.ciphertext,
        });
        this.setStage("persist", "done");
        return null;
      }
      case "submit": {
        if (!this.signedRequest || !this.requestSigner) {
          return this.fail("submit", "failed", "Missing signed relay request");
        }
        this.setStage("submit", "active");
        try {
          const result = await this.relaySubmitter({
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
          this.setStage("submit", "done");
          return null;
        } catch {
          this.setStage("submit", "error", "Relay submission failed");
          return this.fail("submit", "relay_rejected", "Could not reach the relay");
        }
      }
      case "anchor": {
        this.setStage("anchor", "active");
        try {
          if (this.receiptAnchorer) {
            const res = await this.receiptAnchorer(
              this.messageId,
              this.recipientKeys[0]?.account ?? "",
              this.input.sender,
            );
            this.receiptId = res.receiptId;
            this.anchorTxHash = res.anchorTxHash;
          } else {
            await delay(100);
            this.receiptId = `rcpt-${this.messageId.slice(0, 16)}`;
            this.anchorTxHash = `tx-${this.messageId.slice(0, 16)}`;
          }
          this.setStage("anchor", "done", `Receipt anchored (${this.anchorTxHash})`);
          return null;
        } catch {
          this.setStage("anchor", "error", "Receipt anchoring failed");
          return this.fail("anchor", "anchor_failed", "Could not anchor delivery receipt");
        }
      }
      case "reconcile": {
        this.setStage("reconcile", "active");
        if (this.delivered) {
          this.setOutbox("delivered");
          this.setStage("reconcile", "done", "Delivered");
          return null;
        }
        this.setOutbox("failed", { errorCode: this.lastErrorCode });
        this.setStage("reconcile", "error", this.lastErrorCode ?? "Delivery failed");
        return this.fail("reconcile", "failed", this.lastErrorCode ?? "Delivery failed");
      }
      default:
        return null;
    }
  }

  async run(): Promise<SendOutcome> {
    for (const stage of this.stages) {
      if (stage.status === "done") continue;
      const outcome = await this.runStage(stage.id);
      if (outcome) return outcome;
    }
    return {
      ok: true,
      messageId: this.messageId,
      delivered: this.delivered,
      state: this.finalState,
      version: this.version,
      proofReferences: this.getProofReferences(),
      stages: this.getStages(),
    };
  }

  async resume(): Promise<SendOutcome> {
    return this.run();
  }
}
