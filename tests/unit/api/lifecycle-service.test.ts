import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { ApiError } from "../../../src/server/api/errors";
import {
  anchorLifecycle,
  assertLifecycleParticipant,
  buildLifecycleChainAdapter,
  getLifecycleStatus,
  MAX_LIFECYCLE_ANCHOR_ATTEMPTS,
  reconcileLifecycleStatus,
  scheduleLifecycleAnchor,
  type LifecycleAnchorInput,
  type LifecycleAnchorOutcome,
  type LifecycleChainAdapter,
} from "../../../src/server/api/lifecycle-service";
import { lifecycle } from "../../../src/services/stellar/contracts";
import { Keypair } from "@stellar/stellar-sdk";

const sender = `G${"B".repeat(55)}`;
const recipient = `G${"A".repeat(55)}`;
const messageId = "a".repeat(64);

function input(overrides: Partial<LifecycleAnchorInput> = {}): LifecycleAnchorInput {
  return {
    messageId,
    sender,
    recipient,
    amount: "100",
    verified: false,
    receiptRequired: false,
    ...overrides,
  };
}

class StubAdapter implements LifecycleChainAdapter {
  outcomes: LifecycleAnchorOutcome[] = [];
  chainFound: boolean | null = null;

  async anchor(): Promise<LifecycleAnchorOutcome> {
    const outcome = this.outcomes.shift();
    if (!outcome) {
      return { status: "confirmed" as const, txHash: "deadbeef" };
    }
    return outcome;
  }

  async getStatus(): Promise<{ found: boolean }> {
    if (this.chainFound === null) {
      return { found: true };
    }
    return { found: this.chainFound };
  }
}

describe("lifecycle anchoring (BETA-043 / Issue #1950)", () => {
  describe("scheduleLifecycleAnchor", () => {
    it("records a fresh pending anchor", async () => {
      const repository = new MemoryApiRepository();

      const anchor = await scheduleLifecycleAnchor(repository, input());

      expect(anchor).toMatchObject({
        messageId,
        sender,
        recipient,
        amount: "100",
        verified: false,
        receiptRequired: false,
        status: "pending",
        failureCount: 0,
        lastError: null,
        txHash: null,
      });
    });

    it("is idempotent for identical details", async () => {
      const repository = new MemoryApiRepository();

      await scheduleLifecycleAnchor(repository, input());
      const second = await scheduleLifecycleAnchor(repository, input());

      const stored = await repository.getLifecycleAnchor(messageId);
      expect(stored?.status).toBe("pending");
      expect(stored?.scheduledAt).toBe(second.scheduledAt);
    });

    it("conflicts when the same commitment is scheduled with different details", async () => {
      const repository = new MemoryApiRepository();

      await scheduleLifecycleAnchor(repository, input());
      await expect(
        scheduleLifecycleAnchor(repository, input({ amount: "999" })),
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("re-arms a failed anchor as pending", async () => {
      const repository = new MemoryApiRepository();

      await scheduleLifecycleAnchor(repository, input());
      await repository.setLifecycleAnchor({
        ...(await repository.getLifecycleAnchor(messageId))!,
        status: "failed",
        failureCount: 2,
        lastError: "lifecycle_anchor_retryable:rpc_unavailable",
      });

      const rearmed = await scheduleLifecycleAnchor(repository, input());

      expect(rearmed.status).toBe("pending");
      expect(rearmed.lastError).toBeNull();
    });
  });

  describe("getLifecycleStatus / assertLifecycleParticipant", () => {
    it("returns the stored anchor", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());

      const anchor = await getLifecycleStatus(repository, messageId);

      expect(anchor.messageId).toBe(messageId);
    });

    it("throws 404 for an unknown commitment", async () => {
      const repository = new MemoryApiRepository();

      await expect(getLifecycleStatus(repository, messageId)).rejects.toMatchObject({
        status: 404,
        code: "not_found",
      });
    });

    it("allows the sender and the recipient", () => {
      const anchor = { sender, recipient };
      expect(() => assertLifecycleParticipant(anchor, sender)).not.toThrow();
      expect(() => assertLifecycleParticipant(anchor, recipient)).not.toThrow();
    });

    it("forbids unrelated actors", () => {
      const stranger = `G${"C".repeat(55)}`;
      expect(() => assertLifecycleParticipant({ sender, recipient }, stranger)).toThrow(ApiError);
    });
  });

  describe("anchorLifecycle", () => {
    it("is idempotent for an already-confirmed anchor", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      await repository.setLifecycleAnchor({
        ...(await repository.getLifecycleAnchor(messageId))!,
        status: "confirmed",
        txHash: "tx-confirmed",
      });
      const adapter = new StubAdapter();

      const anchor = await anchorLifecycle(repository, adapter, messageId);

      expect(anchor.status).toBe("confirmed");
      expect(anchor.txHash).toBe("tx-confirmed");
    });

    it("confirms on a confirmed chain outcome", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      const adapter = new StubAdapter();
      adapter.outcomes = [{ status: "confirmed", txHash: "tx-abc" }];

      const anchor = await anchorLifecycle(repository, adapter, messageId);

      expect(anchor).toMatchObject({ status: "confirmed", txHash: "tx-abc", lastError: null });
    });

    it("treats DuplicateLifecycle as a success (idempotent collapse)", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      const adapter = new StubAdapter();
      adapter.outcomes = [{ status: "duplicate" }];

      const anchor = await anchorLifecycle(repository, adapter, messageId);

      expect(anchor.status).toBe("confirmed");
      expect(anchor.lastError).toBeNull();
    });

    it("fails durably on a mismatch outcome with a sanitized code", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      const adapter = new StubAdapter();
      adapter.outcomes = [{ status: "mismatch", code: lifecycle.LifecycleError.PostageMismatch }];

      const anchor = await anchorLifecycle(repository, adapter, messageId);

      expect(anchor.status).toBe("failed");
      expect(anchor.failureCount).toBe(1);
      expect(anchor.lastError).toContain("lifecycle_anchor_mismatch");
      expect(anchor.lastError).toContain(`${lifecycle.LifecycleError.PostageMismatch}`);
    });

    it("advances to submitted on a retryable outcome until attempts are exhausted", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      const adapter = new StubAdapter();
      adapter.outcomes = Array.from(
        { length: MAX_LIFECYCLE_ANCHOR_ATTEMPTS },
        () => ({ status: "retryable", reason: "rpc_unavailable" }) as const,
      );

      for (let i = 1; i < MAX_LIFECYCLE_ANCHOR_ATTEMPTS; i += 1) {
        const anchor = await anchorLifecycle(repository, adapter, messageId);
        expect(anchor.status).toBe("submitted");
        expect(anchor.failureCount).toBe(i);
      }

      const exhausted = await anchorLifecycle(repository, adapter, messageId);
      expect(exhausted.status).toBe("failed");
      expect(exhausted.failureCount).toBe(MAX_LIFECYCLE_ANCHOR_ATTEMPTS);
      expect(exhausted.lastError).toContain("lifecycle_anchor_retryable");
    });
  });

  describe("reconcileLifecycleStatus", () => {
    it("confirms an anchor present on chain", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      const adapter = new StubAdapter();
      adapter.chainFound = true;

      const anchor = await reconcileLifecycleStatus(repository, adapter, messageId);

      expect(anchor.status).toBe("confirmed");
    });

    it("leaves the anchor pending when the chain has no record yet", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      const adapter = new StubAdapter();
      adapter.chainFound = false;

      const anchor = await reconcileLifecycleStatus(repository, adapter, messageId);

      expect(anchor.status).toBe("pending");
    });

    it("is idempotent for an already-confirmed anchor", async () => {
      const repository = new MemoryApiRepository();
      await scheduleLifecycleAnchor(repository, input());
      await repository.setLifecycleAnchor({
        ...(await repository.getLifecycleAnchor(messageId))!,
        status: "confirmed",
      });
      const adapter = new StubAdapter();

      const anchor = await reconcileLifecycleStatus(repository, adapter, messageId);

      expect(anchor.status).toBe("confirmed");
    });
  });

  describe("buildLifecycleChainAdapter", () => {
    it("throws when no operator keypair is configured", () => {
      const config = {
        network: {
          networkPassphrase: "Test SDF Network ; September 2015",
          sorobanRpcUrl: "https://localhost",
        },
        contract: { lifecycleContractId: "CAAAA1" },
        secrets: {},
      };

      expect(() => buildLifecycleChainAdapter(config as never)).toThrow(ApiError);
    });

    it("builds a Soroban adapter from the operator secret", () => {
      const operator = Keypair.random();
      const config = {
        network: {
          networkPassphrase: "Test SDF Network ; September 2015",
          sorobanRpcUrl: "https://localhost",
        },
        contract: { lifecycleContractId: "CAAAA1" },
        secrets: { operatorSecret: operator.secret() },
      };

      const adapter = buildLifecycleChainAdapter(config as never);

      expect(adapter).toBeDefined();
      expect(typeof adapter.anchor).toBe("function");
      expect(typeof adapter.getStatus).toBe("function");
    });
  });
});
