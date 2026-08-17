/**
 * Compose send pipeline.
 *
 * Orchestrates the staged send: encrypt -> sign -> postage -> persist ->
 * submit -> reconcile. Each stage reports progress and can be retried by
 * calling run() again (completed stages are skipped). A wallet rejection stops
 * before anything is persisted or sent, leaving the draft intact. Plaintext is
 * never logged here.
 */
import { canonicalizePayload, sealEnvelope, type SealedEnvelope } from "@/services/crypto/envelope";
import {
  authorizeSend,
  WalletRejectedError,
  WalletUnavailableError,
  type WalletSignature,
} from "@/services/stellar/wallet";
import { createEntry, patchEntry, type OutboxStatus } from "@/services/storage/outbox";
import { submitToRelay } from "@/services/relay/submit";
import { parseRecipients } from "@/components/mail/composeValidation";
import type { DeliveryState } from "@/services/relay/federation";

export type StageId = "encrypt" | "sign" | "postage" | "persist" | "submit" | "reconcile";

export type StageStatus = "pending" | "active" | "done" | "error";

export interface StageState {
  id: StageId;
  label: string;
  status: StageStatus;
  detail?: string;
}

export type SendFailureReason = "wallet_rejected" | "wallet_unavailable" | "failed";

export type SendOutcome =
  | { ok: true; messageId: string; delivered: boolean; state: DeliveryState }
  | {
      ok: false;
      messageId: string;
      stage: StageId;
      reason: SendFailureReason;
      message: string;
    };

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
}

const STAGE_LABELS: Record<StageId, string> = {
  encrypt: "Encrypting message",
  sign: "Awaiting wallet signature",
  postage: "Reserving postage",
  persist: "Saving to outbox",
  submit: "Submitting to relay",
  reconcile: "Confirming delivery",
};

const STAGE_ORDER: StageId[] = ["encrypt", "sign", "postage", "persist", "submit", "reconcile"];

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

  private sealed?: SealedEnvelope;
  private signature?: WalletSignature;
  private canonical = "";
  private delivered = false;
  private finalState: DeliveryState = "DEAD_LETTER";
  private lastErrorCode?: string;

  constructor(input: SendPipelineInput, onProgress?: (stages: StageState[]) => void) {
    this.input = input;
    this.onProgress = onProgress;
    this.messageId = input.messageId ?? newMessageId();
    this.recipients = parseRecipients(input.to);
    this.domain = deriveDomain(this.recipients[0] ?? "");
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

  private fail(stage: StageId, reason: SendFailureReason, message: string): SendOutcome {
    return { ok: false, messageId: this.messageId, stage, reason, message };
  }

  private async runStage(id: StageId): Promise<SendOutcome | null> {
    switch (id) {
      case "encrypt": {
        this.setStage("encrypt", "active");
        try {
          this.sealed = await sealEnvelope({
            sender: this.input.sender,
            recipient: this.recipients[0] ?? "",
            body: this.input.body,
            attachments: this.input.attachments,
          });
          this.canonical = canonicalizePayload(this.sealed.payload);
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
          this.signature = await authorizeSend(this.canonical);
          this.setStage("sign", "done");
          return null;
        } catch (error) {
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
        this.setStage("submit", "active");
        try {
          const envelopeJson = JSON.stringify({
            payload: this.sealed?.payload,
            signature: this.signature,
            ciphertext: this.sealed?.ciphertext,
          });
          const result = await submitToRelay({
            messageId: this.messageId,
            recipientDomain: this.domain,
            envelopePayload: envelopeJson,
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
