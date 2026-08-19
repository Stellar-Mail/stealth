import { describe, expect, it } from "vitest";
import {
  computePayloadHash,
  StaticReceiptsContractProvider,
} from "../../../src/server/api/receipt-contract-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

describe("receipt-contract-service", () => {
  it("computes a deterministic 32-byte sha256 payload hash", () => {
    const hash1 = computePayloadHash(messageId, "hello world");
    const hash2 = computePayloadHash(messageId, "hello world");
    const hash3 = computePayloadHash(messageId, "different payload");

    expect(hash1).toHaveLength(64);
    expect(hash1).toEqual(hash2);
    expect(hash1).not.toEqual(hash3);
  });

  it("publishes delivered receipt on contract provider and gets on-chain record", async () => {
    const provider = new StaticReceiptsContractProvider();
    const result = await provider.publishDeliveredReceipt({
      messageId,
      sender,
      recipient,
    });

    expect(result).toMatchObject({
      messageId,
      sender,
      recipient,
      confirmed: true,
    });
    expect(result.payloadHash).toHaveLength(64);

    const fetched = await provider.getOnChainReceipt(messageId);
    expect(fetched).toEqual(result);
  });

  it("rejects delivered receipt commitment mismatch", async () => {
    const provider = new StaticReceiptsContractProvider();
    await provider.publishDeliveredReceipt({ messageId, sender, recipient });

    await expect(
      provider.publishDeliveredReceipt({
        messageId,
        sender,
        recipient,
        payloadHash: "f".repeat(64),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("publishes read receipt for message recipient and preserves read timestamp", async () => {
    const provider = new StaticReceiptsContractProvider();
    await provider.publishDeliveredReceipt({ messageId, sender, recipient });

    const readAt = "2026-08-18T10:00:00.000Z";
    const readResult = await provider.publishReadReceipt({
      messageId,
      actor: recipient,
      readAt,
    });

    expect(readResult.readAt).toBe(readAt);

    // Idempotent duplicate read preserves initial timestamp
    const duplicateRead = await provider.publishReadReceipt({
      messageId,
      actor: recipient,
      readAt: "2026-08-18T11:00:00.000Z",
    });
    expect(duplicateRead.readAt).toBe(readAt);
  });

  it("rejects unauthorized non-recipient read receipt publication", async () => {
    const provider = new StaticReceiptsContractProvider();
    await provider.publishDeliveredReceipt({ messageId, sender, recipient });

    await expect(
      provider.publishReadReceipt({
        messageId,
        actor: sender,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
