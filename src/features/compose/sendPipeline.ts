/**
 * Compose send pipeline.
 *
 * Orchestrates the staged send: resolve -> encrypt -> sign -> postage ->
 * persist -> submit -> reconcile. Each stage reports progress and can be
 * retried by calling run() again (completed stages are skipped). A wallet
 * rejection stops before anything is persisted or sent, leaving the draft
 * intact. Plaintext is never logged here.
 *
 * The recipient keys are fetched from the versioned public key directory
 * (BETA-027) and validated against the send-path domain rules before any
 * encryption; revoked, expired, not-yet-valid, unsupported, or wrong-network
 * material rejects the send with a structured, recoverable error stage. The
 * signature covers the canonical relay request (envelope payload plus the
 * anti-replay fields), so the relay accepts one canonical signed envelope.
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
  | "encrypt"
  | "sign"
  | "postage"
  | "persist"
  | "submit"
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
  | "wallet_rejected"
  | "wallet_unavailable"
  | "failed";

export type SendOutcome =
  | { ok: true; messageId: string; delivered: boolean; state: DeliveryState }
  | {
      ok: false;
      messageId: string;
      stage: StageId;
      reason: SendFailureReason;
      message: string;
      code?: string;
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

const STAGE_LABELS: Record<StageId, string> = {
  resolve: "Resolving recipient keys",
  encrypt: "Encrypting message",
  sign: "Awaiting wallet signature",
  postage: "Reserving postage",
  persist: "Saving to outbox",
  submit: "Submitting to relay",
  reconcile: "Confirming delivery",
};

const STAGE_ORDER: StageId[] = [
  "resolve",
  "encrypt",
  "sign",
  "postage",
  "persist",
  "submit",
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

  /** Injected seams for tests / alternate signers. */
  private readonly signer: (canonical: string) => Promise<WalletSignature>;
  private readonly keyResolver?: DirectoryRecipientKeyResolver;

  constructor(
    input: SendPipelineInput,
    onProgress?: (stages: StageState[]) => void,
    options: {
      signer?: (canonical: string) => Promise<WalletSignature>;
      keyResolver?: DirectoryRecipientKeyResolver;
    } = {},
  ) {
    this.input = input;
    this.onProgress = onProgress;
    this.messageId = input.messageId ?? newMessageId();
    this.recipients = parseRecipients(input.to);
    this.domain = deriveDomain(this.recipients[0] ?? "");
    this.audience = input.audience ?? DEFAULT_RELAY_AUDIENCE;
    this.signer = options.signer ?? authorizeSend;
    this.keyResolver = options.keyResolver;
    this.stages = STAGE_ORDER.map((id) => ({
      id,
      label: STAGE_LABELS[id],
      status: "pending" as StageStatus,
    }));
  }

  getStages(): StageState[] {
    return this.stages.map((stage) => ({ ...stage }));
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
      case "postage": {
        this.setStage("postage", "active");
        // No on-chain postage service in this client yet; reserve is simulated.
        await delay(150);
        this.setStage("postage", "done");
        return null;
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
          this.setStage("submit", "done");
          return null;
        } catch {
          this.setStage("submit", "error", "Relay submission failed");
          return this.fail("submit", "failed", "Could not reach the relay");
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
    };
  }
}
