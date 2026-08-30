/**
 * SendCoordinator unit tests (BETA-048 / #1954).
 *
 * Tests recoverable, versioned send operations, idempotency, proof references,
 * postage escrow reservation/settlement/refund, delivery receipts, and resume capabilities.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { getDeliveryState } from "@/server/api/delivery-service";
import { SendCoordinator } from "@/server/api/send-coordinator";
import { createApiContext, type ApiContext, type ApiPrincipal } from "@/server/api/context";

const SENDER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const RECIPIENT = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("SendCoordinator (BETA-048)", () => {
  let repo: MemoryApiRepository;
  let context: ApiContext;
  let coordinator: SendCoordinator;
  const messageId = "msg-00000000000000000000000000000001";

  beforeEach(() => {
    repo = new MemoryApiRepository();
    const principal: ApiPrincipal = {
      address: SENDER,
      authMethod: "test",
      authenticatedAt: new Date(),
      metadata: {},
    };

    context = createApiContext(repo, principal, "req-test-123");
    coordinator = new SendCoordinator({ now: () => new Date("2026-08-18T12:00:00Z") });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a versioned operation state idempotently", async () => {
    const op1 = await coordinator.createOperation(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
      recipientDomain: "stellar.org",
    });

    expect(op1.version).toBe(1);
    expect(op1.status).toBe("created");
    expect(op1.messageId).toBe(messageId);
    expect(op1.proofReferences?.relayMessageId).toBe(messageId);

    // Second call with same messageId returns existing state
    const op2 = await coordinator.createOperation(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
      recipientDomain: "stellar.org",
    });

    expect(op2.createdAt).toBe(op1.createdAt);
    expect(op2.version).toBe(1);
  });

  it("records queued delivery state at operation creation (BETA-035)", async () => {
    await coordinator.createOperation(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
    });

    const delivery = await getDeliveryState(repo, messageId);
    expect(delivery.state).toBe("queued");
    expect(delivery.actor).toBe(SENDER);
    expect(delivery.reason).toBe("Send operation created");
    expect(delivery.history).toHaveLength(1);
    expect(delivery.history[0]?.toState).toBe("queued");

    await coordinator.createOperation(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
    });

    const afterRetry = await getDeliveryState(repo, messageId);
    expect(afterRetry.state).toBe("queued");
    expect(afterRetry.history).toHaveLength(1);
  });

  it("requests a postage quote and attaches it to the operation state", async () => {
    await coordinator.createOperation(context, { messageId, sender: SENDER, recipient: RECIPIENT });

    const { state, quote } = await coordinator.requestQuote(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
    });

    expect(state.status).toBe("quoted");
    expect(state.quote).toBeDefined();
    expect(quote.amount).toBeDefined();

    // Repeated quote request returns existing quote
    const req2 = await coordinator.requestQuote(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
    });
    expect(req2.state.status).toBe("quoted");
  });

  it("registers postage escrow idempotently and attaches postage payment hash", async () => {
    await coordinator.createOperation(context, { messageId, sender: SENDER, recipient: RECIPIENT });
    const { quote } = await coordinator.requestQuote(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
    });

    const submissionInput = {
      amount: quote.amount,
      messageId,
      paymentHash: "00".repeat(32),
      recipient: RECIPIENT,
      sender: SENDER,
      asset: quote.asset,
      policyVersion: quote.policyVersion,
      network: quote.network,
      issuedAt: quote.issuedAt,
      expiresAt: quote.expiresAt,
      quoteDigest: quote.digest,
    };

    const { state, postage } = await coordinator.registerEscrow(context, submissionInput);

    expect(state.status).toBe("escrowed");
    expect(state.proofReferences?.postagePaymentHash).toBe("00".repeat(32));
    expect(postage.status).toBe("pending");

    // Duplicate call returns existing escrowed postage without re-charge
    const second = await coordinator.registerEscrow(context, submissionInput);
    expect(second.postage.paymentHash).toBe(postage.paymentHash);
    expect(second.state.status).toBe("escrowed");
  });

  it("anchors delivery receipt and attaches receiptId and anchorTxHash proof references", async () => {
    await coordinator.createOperation(context, { messageId, sender: SENDER, recipient: RECIPIENT });

    const { state, receipt } = await coordinator.anchorReceipt(context, {
      messageId,
      recipient: RECIPIENT,
      sender: SENDER,
      anchorTxHash: "tx-soroban-anchor-12345",
    });

    expect(state.status).toBe("anchored");
    expect(state.proofReferences?.receiptId).toBe(`rcpt-${messageId}`);
    expect(state.proofReferences?.anchorTxHash).toBe("tx-soroban-anchor-12345");
    expect(receipt.deliveredAt).toBeDefined();
  });

  it("reconciles delivered operation and settles escrow", async () => {
    await coordinator.createOperation(context, { messageId, sender: SENDER, recipient: RECIPIENT });
    const { quote } = await coordinator.requestQuote(context, {
      messageId,
      sender: SENDER,
      recipient: RECIPIENT,
    });

    await coordinator.registerEscrow(context, {
      amount: quote.amount,
      messageId,
      paymentHash: "11".repeat(32),
      recipient: RECIPIENT,
      sender: SENDER,
      asset: quote.asset,
      policyVersion: quote.policyVersion,
      network: quote.network,
      issuedAt: quote.issuedAt,
      expiresAt: quote.expiresAt,
      quoteDigest: quote.digest,
    });

    await coordinator.anchorReceipt(context, { messageId, recipient: RECIPIENT, sender: SENDER });

    const finalState = await coordinator.reconcileOperation(context, messageId);

    expect(finalState.status).toBe("delivered");
    const storedPostage = await repo.getPostage(messageId);
    expect(storedPostage?.status).toBe("settled");
  });

  it("resumes an in-flight operation safely", async () => {
    await coordinator.createOperation(context, { messageId, sender: SENDER, recipient: RECIPIENT });
    await coordinator.anchorReceipt(context, { messageId, recipient: RECIPIENT, sender: SENDER });

    const resumed = await coordinator.resumeOperation(context, messageId);
    expect(resumed.status).toBe("delivered");
  });
});
