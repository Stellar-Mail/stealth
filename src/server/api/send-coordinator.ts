import type { ApiContext } from "./context";
import { ApiError } from "./errors";
import {
  quotePostage,
  submitPostage,
  verifyQuoteSubmission,
  resolvePostage,
  type PostageQuoteResult,
  type QuoteSubmissionInput,
} from "./postage-service";
import { advanceToDeliveryState } from "./delivery-hooks";
import { createDeliveryReceipt } from "./receipt-service";
import {
  submitToRelay,
  type RelaySubmitInput,
  type RelaySubmitResult,
} from "@/services/relay/submit";
import type { SendOperationState, SendOperationStatus, Postage, Receipt } from "./domain";
import { recordAuditEvent } from "./audit";

export interface CreateSendOperationInput {
  messageId: string;
  sender: string;
  recipient: string;
  recipientDomain?: string;
  idempotencyKey?: string;
}

export interface SendCoordinatorOptions {
  now?: () => Date;
}

export class SendCoordinator {
  constructor(private readonly options: SendCoordinatorOptions = {}) {}

  private now(): Date {
    return this.options.now ? this.options.now() : new Date();
  }

  /**
   * Idempotently creates a recoverable message operation before any charges or side effects occur.
   */
  async createOperation(
    context: ApiContext,
    input: CreateSendOperationInput,
  ): Promise<SendOperationState> {
    const repo = context.repository;
    const nowIso = this.now().toISOString();
    const idempotencyKey = input.idempotencyKey ?? `idem-send-${input.messageId}`;

    const initialState: SendOperationState = {
      version: 1,
      messageId: input.messageId,
      sender: input.sender,
      recipient: input.recipient,
      recipientDomain: input.recipientDomain ?? "stellar.network",
      status: "created",
      idempotencyKey,
      createdAt: nowIso,
      updatedAt: nowIso,
      proofReferences: {
        relayMessageId: input.messageId,
      },
    };

    const { state } = await repo.createSendOperationIfAbsent(initialState);

    await advanceToDeliveryState(
      repo,
      input.messageId,
      "queued",
      input.sender,
      "Send operation created",
      null,
      this.now(),
    );

    recordAuditEvent({
      actor: input.sender,
      action: "send_coordinator.create",
      targetType: "message",
      safeTargetReference: input.messageId,
      result: "success",
      requestId: context.requestId ?? "unknown",
    });

    return state;
  }

  /**
   * Obtains a quote and binds it to the send operation state.
   */
  async requestQuote(
    context: ApiContext,
    input: { messageId: string; sender: string; recipient: string },
  ): Promise<{ state: SendOperationState; quote: PostageQuoteResult }> {
    const op = await this.getOperation(context, input.messageId);

    if (op.quote) {
      return { state: op, quote: op.quote as unknown as PostageQuoteResult };
    }

    const quote = await quotePostage(context, input, { now: () => this.now() });

    const updated: SendOperationState = {
      ...op,
      quote: quote as unknown as Record<string, unknown>,
      status: op.status === "created" ? "quoted" : op.status,
      updatedAt: this.now().toISOString(),
    };

    const saved = await context.repository.setSendOperation(updated);
    return { state: saved, quote };
  }

  /**
   * Idempotently registers or reserves postage escrow.
   * If postage has already been submitted for this messageId, reuses existing postage.
   */
  async registerEscrow(
    context: ApiContext,
    input: QuoteSubmissionInput & { paymentHash: string },
  ): Promise<{ state: SendOperationState; postage: Postage }> {
    const op = await this.getOperation(context, input.messageId);

    // If escrow is already recorded for this operation, return existing postage
    const existingPostage = await context.repository.getPostage(input.messageId);
    if (existingPostage) {
      const updated: SendOperationState = {
        ...op,
        postage: existingPostage,
        status: op.status === "created" || op.status === "quoted" ? "escrowed" : op.status,
        proofReferences: {
          ...op.proofReferences,
          postagePaymentHash: existingPostage.paymentHash,
        },
        updatedAt: this.now().toISOString(),
      };
      const saved = await context.repository.setSendOperation(updated);
      return { state: saved, postage: existingPostage };
    }

    await verifyQuoteSubmission(context, input, { now: () => this.now() });

    const { issuedAt, expiresAt, quoteDigest, ...postageInput } = input;
    const postage = await submitPostage(context, postageInput, this.now());

    const updated: SendOperationState = {
      ...op,
      postage,
      status: "escrowed",
      proofReferences: {
        ...op.proofReferences,
        postagePaymentHash: postage.paymentHash,
      },
      updatedAt: this.now().toISOString(),
    };

    const saved = await context.repository.setSendOperation(updated);

    recordAuditEvent({
      actor: input.sender,
      action: "send_coordinator.escrow",
      targetType: "message",
      safeTargetReference: input.messageId,
      result: "success",
      requestId: context.requestId ?? "unknown",
    });

    return { state: saved, postage };
  }

  /**
   * Submits the signed payload to the relay.
   */
  async submitRelay(
    context: ApiContext,
    input: RelaySubmitInput,
  ): Promise<{ state: SendOperationState; submission: RelaySubmitResult }> {
    const op = await this.getOperation(context, input.messageId);

    if (op.relaySubmission && op.relaySubmission.accepted) {
      return { state: op, submission: op.relaySubmission as unknown as RelaySubmitResult };
    }

    const submission = await submitToRelay(input);

    const isAccepted =
      submission.delivered ||
      submission.state === "ACKNOWLEDGED" ||
      submission.state === "DEDUPLICATED";
    const nextStatus: SendOperationStatus = isAccepted ? "submitted" : "failed";

    const updated: SendOperationState = {
      ...op,
      relaySubmission: {
        accepted: isAccepted,
        state: submission.state,
        attempts: submission.attempts,
      },
      status: nextStatus,
      ...(submission.errorCode
        ? { errorCode: submission.errorCode, failureReason: submission.errorCode }
        : {}),
      proofReferences: {
        ...op.proofReferences,
        relayMessageId: input.messageId,
      },
      updatedAt: this.now().toISOString(),
    };

    const saved = await context.repository.setSendOperation(updated);

    await advanceToDeliveryState(
      context.repository,
      input.messageId,
      submission.messageDeliveryState,
      input.sender,
      isAccepted
        ? "Relay accepted message submission"
        : `Relay submission failed (${submission.errorCode ?? submission.state})`,
      null,
      this.now(),
    );

    return { state: saved, submission };
  }

  /**
   * Creates delivery receipt and records proof references / anchor transaction hash.
   */
  async anchorReceipt(
    context: ApiContext,
    input: { messageId: string; recipient: string; sender: string; anchorTxHash?: string },
  ): Promise<{ state: SendOperationState; receipt: Receipt }> {
    const op = await this.getOperation(context, input.messageId);

    const receipt = await createDeliveryReceipt(
      context.repository,
      {
        messageId: input.messageId,
        recipient: input.recipient,
        sender: input.sender,
      },
      this.now(),
    );

    const anchorTxHash =
      input.anchorTxHash ?? op.anchorTxHash ?? `tx-${input.messageId.slice(0, 16)}`;
    const receiptId = `rcpt-${input.messageId}`;

    const updated: SendOperationState = {
      ...op,
      receipt,
      anchorTxHash,
      status: "anchored",
      proofReferences: {
        ...op.proofReferences,
        receiptId,
        anchorTxHash,
      },
      updatedAt: this.now().toISOString(),
    };

    const saved = await context.repository.setSendOperation(updated);
    return { state: saved, receipt };
  }

  /**
   * Reconciles delivery: settles escrow if delivered, refunds if failed.
   */
  async reconcileOperation(context: ApiContext, messageId: string): Promise<SendOperationState> {
    const op = await this.getOperation(context, messageId);

    const isDelivered =
      op.status === "anchored" ||
      op.status === "submitted" ||
      (op.relaySubmission?.accepted ?? false);

    if (isDelivered) {
      if (op.postage && op.postage.status === "pending") {
        try {
          await resolvePostage(context, messageId, "settled");
        } catch {
          // If already settled, conflict is expected and ignored
        }
      }

      const updated: SendOperationState = {
        ...op,
        status: "delivered",
        updatedAt: this.now().toISOString(),
      };
      return context.repository.setSendOperation(updated);
    } else {
      if (op.postage && op.postage.status === "pending") {
        try {
          await resolvePostage(context, messageId, "refunded");
        } catch {
          // Ignore
        }
      }

      const updated: SendOperationState = {
        ...op,
        status: "failed",
        updatedAt: this.now().toISOString(),
      };
      return context.repository.setSendOperation(updated);
    }
  }

  /**
   * Resumes an in-flight send operation safely without double side effects.
   */
  async resumeOperation(context: ApiContext, messageId: string): Promise<SendOperationState> {
    const op = await this.getOperation(context, messageId);

    if (op.status === "delivered" || op.status === "failed") {
      return op;
    }

    return this.reconcileOperation(context, messageId);
  }

  async getOperation(context: ApiContext, messageId: string): Promise<SendOperationState> {
    const op = await context.repository.getSendOperation(messageId);
    if (!op) {
      throw new ApiError(404, "not_found", `Send operation for message ${messageId} was not found`);
    }
    return op;
  }
}
