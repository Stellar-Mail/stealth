import { describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  getPostage,
  resolvePostage,
  submitPostage,
  disputePostage,
  expirePostage,
  reclaimPostage,
} from "../../../src/server/api/postage-service";
import { createApiContext, type ApiContext } from "../../../src/server/api/context";
import type {
  PostageEscrowAdapter,
  PostageEscrowResult,
} from "../../../src/services/stellar/postage-escrow";
import type { Postage as ChainPostage } from "../../../src/services/stellar/contracts/postage";
import { PostageStatus } from "../../../src/services/stellar/contracts/postage";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

function chainPostage(status: PostageStatus): ChainPostage {
  return {
    amount: 1000n,
    created_at: 1000n,
    dispute_until: 2000n,
    expires_at: 3000n,
    fee: 100n,
    recipient,
    sender,
    status,
  };
}

function confirmed(status: PostageStatus, txHash = "tx1"): PostageEscrowResult {
  return {
    success: true,
    postage: chainPostage(status),
    confirmation: { txHash, ledger: 42, createdAtLedger: 41 },
    chainStatus: "confirmed",
    retryClassification: "safe",
  };
}

function makeEscrowStub(overrides: Partial<PostageEscrowAdapter> = {}): PostageEscrowAdapter {
  return {
    isLive: () => true,
    checkAllowanceAndBalance: async () => ({ sufficient: true, required: "0" }),
    readOnChainPostage: async () => null,
    submitEscrow: async () => confirmed(PostageStatus.Pending),
    settleEscrow: async () => confirmed(PostageStatus.Settled),
    refundEscrow: async () => confirmed(PostageStatus.Refunded),
    disputeEscrow: async () => confirmed(PostageStatus.Disputed),
    expireEscrow: async () => confirmed(PostageStatus.Expired),
    reclaimEscrow: async () => confirmed(PostageStatus.Reclaimed),
    ...overrides,
  } as unknown as PostageEscrowAdapter;
}

function contextWithEscrow(repository: MemoryApiRepository, escrow: PostageEscrowAdapter) {
  const context = createApiContext(repository) as ApiContext & {
    repository: MemoryApiRepository;
    escrow: PostageEscrowAdapter;
    _pendingMessageId?: string;
  };
  context.escrow = escrow;
  return context;
}

async function seedPolicy(repository: MemoryApiRepository) {
  await repository.setPolicy(recipient, {
    allowUnknown: true,
    minimumPostage: "100",
    requireVerified: false,
  });
}

function submitInput(prefix = "a") {
  return {
    amount: "125",
    messageId: prefix.repeat(64),
    paymentHash: "b".repeat(64),
    recipient,
    sender,
  };
}

describe("postage escrow service (BETA-042)", () => {
  it("submit syncs confirmed chain bookkeeping onto the record", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const escrow = makeEscrowStub({
      submitEscrow: async () => confirmed(PostageStatus.Pending, "submit-tx-hash"),
    });
    const context = contextWithEscrow(repository, escrow);

    const result = await submitPostage(context, submitInput());

    expect(result.status).toBe("pending");
    expect(result.chainStatus).toBe("confirmed");
    expect(result.txHash).toBe("submit-tx-hash");
    expect(result.ledger).toBe(42);
    expect(result.confirmedAt).toBeDefined();
    expect(result.submittedAt).toBeDefined();
  });

  it("submit reports 502 chain_error and bumps retryCount when the chain throws", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const escrow = makeEscrowStub({
      submitEscrow: async () => {
        throw new Error("timeout while submitting");
      },
    });
    const context = contextWithEscrow(repository, escrow);

    await expect(submitPostage(context, submitInput())).rejects.toMatchObject({
      status: 502,
      code: "chain_error",
    });

    const record = await getPostage(repository, submitInput().messageId);
    expect(record.chainStatus).toBe("failed");
    expect(record.retryCount).toBe(1);
    expect(record.lastError).toContain("timeout");
  });

  it("submit syncs an authoritative terminal state on a safe duplicate", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const escrow = makeEscrowStub({
      submitEscrow: async () => ({
        success: false,
        chainStatus: "failed",
        retryClassification: "safe",
        lastError: "already initialized",
      }),
      readOnChainPostage: async () => chainPostage(PostageStatus.Settled),
    });
    const context = contextWithEscrow(repository, escrow);

    const result = await submitPostage(context, submitInput());

    expect(result.status).toBe("settled");
    expect(result.chainStatus).toBe("confirmed");
  });

  it("submit records an allowance shortfall without touching the chain", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const submitSpy = vi.fn(async () => confirmed(PostageStatus.Pending));
    const escrow = makeEscrowStub({
      checkAllowanceAndBalance: async () => ({
        sufficient: false,
        allowance: "0",
        balance: "0",
        required: "125",
      }),
      submitEscrow: submitSpy,
    });
    const context = contextWithEscrow(repository, escrow);

    const result = await submitPostage(context, submitInput());

    expect(submitSpy).not.toHaveBeenCalled();
    expect(result.chainStatus).toBe("failed");
    expect(result.retryCount).toBe(1);
    expect(result.lastError).toContain("Insufficient balance/allowance");
  });

  it("settle advances a pending record once the chain confirms settlement", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const messageId = submitInput().messageId;
    await submitPostage(contextWithEscrow(repository, makeEscrowStub()), submitInput());

    const escrow = makeEscrowStub({
      settleEscrow: async () => confirmed(PostageStatus.Settled, "settle-tx-hash"),
    });
    const context = contextWithEscrow(repository, escrow);
    context._pendingMessageId = messageId;

    const result = await resolvePostage(context, messageId, "settled");

    expect(result.status).toBe("settled");
    expect(result.txHash).toBe("settle-tx-hash");
    expect(result.ledger).toBe(42);
    expect(result.confirmedAt).toBeDefined();
  });

  it("settle still returns a deterministic conflict when the record is already settled", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const messageId = submitInput().messageId;
    await submitPostage(contextWithEscrow(repository, makeEscrowStub()), submitInput());
    const escrow = makeEscrowStub();
    const context = contextWithEscrow(repository, escrow);
    context._pendingMessageId = messageId;

    await resolvePostage(context, messageId, "settled");

    await expect(resolvePostage(context, messageId, "settled")).rejects.toMatchObject({
      status: 409,
      code: "conflict",
      details: {
        currentStatus: "settled",
        attemptedStatus: "settled",
        messageId,
      },
    });
  });

  it("dispute/expire/reclaim sync confirmed lifecycle transitions", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);

    const disputeMsg = submitInput("c").messageId;
    await submitPostage(contextWithEscrow(repository, makeEscrowStub()), submitInput("c"));
    const disputed = await disputePostage(
      contextWithEscrow(
        repository,
        makeEscrowStub({
          disputeEscrow: async () => confirmed(PostageStatus.Disputed, "dispute-tx"),
        }),
      ),
      disputeMsg,
    );
    expect(disputed.status).toBe("disputed");
    expect(disputed.txHash).toBe("dispute-tx");

    const expireMsg = submitInput("d").messageId;
    await submitPostage(contextWithEscrow(repository, makeEscrowStub()), submitInput("d"));
    const expired = await expirePostage(
      contextWithEscrow(
        repository,
        makeEscrowStub({ expireEscrow: async () => confirmed(PostageStatus.Expired, "expire-tx") }),
      ),
      expireMsg,
    );
    expect(expired.status).toBe("expired");
    expect(expired.txHash).toBe("expire-tx");

    const reclaimMsg = submitInput("e").messageId;
    await submitPostage(contextWithEscrow(repository, makeEscrowStub()), submitInput("e"));
    const reclaimed = await reclaimPostage(
      contextWithEscrow(
        repository,
        makeEscrowStub({
          reclaimEscrow: async () => confirmed(PostageStatus.Reclaimed, "reclaim-tx"),
        }),
      ),
      reclaimMsg,
    );
    expect(reclaimed.status).toBe("reclaimed");
    expect(reclaimed.txHash).toBe("reclaim-tx");
  });

  it("falls back to off-chain transitions when the escrow adapter is not live", async () => {
    const repository = new MemoryApiRepository();
    await seedPolicy(repository);
    const messageId = submitInput().messageId;
    await submitPostage(createApiContext(repository), submitInput());

    const settled = await resolvePostage(createApiContext(repository), messageId, "settled");
    expect(settled.status).toBe("settled");

    await expect(
      resolvePostage(createApiContext(repository), messageId, "settled"),
    ).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
  });
});
