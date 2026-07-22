import { beforeEach, describe, expect, it } from "vitest";
import { ValidatedApiRepository, registerRecordSchema } from "../../../src/server/api/repository";
import { ValidatedApiRepository as ValidatedRepo } from "../../../src/server/api/repository";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { DataIntegrityError } from "../../../src/server/api/errors";
import {
  mailboxPolicySchema,
  senderRuleSchema,
  postageSchema,
  receiptSchema,
  idempotencyRecordSchema,
} from "../../../src/server/api/domain";

// Register schemas for validation (same as context.ts)
registerRecordSchema("mailboxPolicy", mailboxPolicySchema);
registerRecordSchema("senderRule", senderRuleSchema);
registerRecordSchema("postage", postageSchema);
registerRecordSchema("receipt", receiptSchema);
registerRecordSchema("idempotencyRecord", idempotencyRecordSchema);

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

describe("ValidatedApiRepository - record integrity", () => {
  let inner: MemoryApiRepository;
  let repo: ValidatedApiRepository;

  beforeEach(() => {
    inner = new MemoryApiRepository();
    repo = new ValidatedApiRepository(inner);
  });

  it("passes through valid records", async () => {
    await inner.setPolicy(owner, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    await expect(repo.getPolicy(owner)).resolves.toMatchObject({
      allowUnknown: true,
      minimumPostage: "100",
    });
  });

  it("throws DataIntegrityError when stored policy record is corrupt", async () => {
    const innerMap = (inner as any)["policies"] as Map<string, unknown>;
    innerMap.set(owner, { allowUnknown: "not-a-boolean", minimumPostage: "100" });

    let error: unknown;
    try {
      await repo.getPolicy(owner);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DataIntegrityError);
    if (error instanceof DataIntegrityError) {
      expect(error.recordType).toBe("mailboxPolicy");
      expect(error.correlationId).toMatch(/^di-/);
    }
  });

  it("throws DataIntegrityError when stored postage record is corrupt", async () => {
    const innerMap = (inner as any)["postage"] as Map<string, unknown>;
    innerMap.set(messageId, {
      amount: "not-a-number",
      createdAt: "invalid-date",
      messageId,
    });

    let error: unknown;
    try {
      await repo.getPostage(messageId);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DataIntegrityError);
    if (error instanceof DataIntegrityError) {
      expect(error.recordType).toBe("postage");
    }
  });

  it("throws DataIntegrityError when stored receipt record is corrupt", async () => {
    const innerMap = (inner as any)["receipts"] as Map<string, unknown>;
    innerMap.set(messageId, {
      deliveredAt: null,
      messageId: 12345,
      readAt: null,
      recipient: "not-a-valid-address",
    });

    let error: unknown;
    try {
      await repo.getReceipt(messageId);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DataIntegrityError);
    if (error instanceof DataIntegrityError) {
      expect(error.recordType).toBe("receipt");
    }
  });

  it("throws DataIntegrityError when stored sender rule is corrupt", async () => {
    const innerMap = (inner as any)["senderRules"] as Map<string, unknown>;
    innerMap.set(`${owner}:${sender}`, "invalid-rule-value");

    let error: unknown;
    try {
      await repo.getSenderRule(owner, sender);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DataIntegrityError);
    if (error instanceof DataIntegrityError) {
      expect(error.recordType).toBe("senderRule");
    }
  });

  it("returns null for missing records (not corrupt)", async () => {
    await expect(repo.getPolicy("nonexistent")).resolves.toBeNull();
    await expect(repo.getPostage("nonexistent")).resolves.toBeNull();
    await expect(repo.getReceipt("nonexistent")).resolves.toBeNull();
  });

  it("does not corrupt the error message reveal the record payload", async () => {
    const innerMap = (inner as any)["policies"] as Map<string, unknown>;
    innerMap.set(owner, { allowUnknown: "bad-value" });

    let error: unknown;
    try {
      await repo.getPolicy(owner);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DataIntegrityError);
    if (error instanceof DataIntegrityError) {
      expect(error.message).not.toContain("bad-value");
      expect(error.message).toContain("mailboxPolicy");
    }
  });

  it("generates unique correlation IDs for each integrity error", async () => {
    const innerMap = (inner as any)["policies"] as Map<string, unknown>;
    innerMap.set(owner, { allowUnknown: "bad" });

    try {
      await repo.getPolicy(owner);
    } catch (e1) {
      try {
        innerMap.set(owner, { allowUnknown: "also-bad" });
        await repo.getPolicy(owner);
      } catch (e2) {
        expect(e1).toBeInstanceOf(DataIntegrityError);
        expect(e2).toBeInstanceOf(DataIntegrityError);
        if (e1 instanceof DataIntegrityError && e2 instanceof DataIntegrityError) {
          expect(e1.correlationId).not.toBe(e2.correlationId);
        }
        return;
      }
    }
  });
});
