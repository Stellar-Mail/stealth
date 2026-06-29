import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  assertReceiptParticipant,
  createDeliveryReceipt,
  getReceipt,
  markReceiptRead,
} from "../../../src/server/api/receipt-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

describe("receipt service", () => {
  it("creates one sender-authored delivery receipt", async () => {
    const repository = new MemoryApiRepository();
    const input = { messageId, recipient, sender };

    await expect(
      createDeliveryReceipt(repository, input, new Date("2026-06-14T12:00:00.000Z")),
    ).resolves.toEqual({
      deliveredAt: "2026-06-14T12:00:00.000Z",
      messageId,
      readAt: null,
      recipient,
      sender,
    });

    await expect(createDeliveryReceipt(repository, input)).rejects.toMatchObject({ status: 409 });
  });

  it("returns receipts only to message participants", async () => {
    const repository = new MemoryApiRepository();
    const receipt = await createDeliveryReceipt(repository, { messageId, recipient, sender });

    await expect(getReceipt(repository, messageId)).resolves.toEqual(receipt);
    expect(() => assertReceiptParticipant(receipt, recipient)).not.toThrow();
    expect(() => assertReceiptParticipant(receipt, `G${"C".repeat(55)}`)).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("records the recipient read timestamp once", async () => {
    const repository = new MemoryApiRepository();
    await createDeliveryReceipt(repository, { messageId, recipient, sender });

    await expect(
      markReceiptRead(repository, messageId, new Date("2026-06-14T12:30:00.000Z")),
    ).resolves.toMatchObject({ readAt: "2026-06-14T12:30:00.000Z" });
    await expect(markReceiptRead(repository, messageId)).rejects.toMatchObject({ status: 409 });
  });

  it("throws 404 when getting a non-existent receipt", async () => {
    const repository = new MemoryApiRepository();
    await expect(getReceipt(repository, "nonexistent")).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when marking read on a non-existent receipt", async () => {
    const repository = new MemoryApiRepository();
    await expect(markReceiptRead(repository, "nonexistent")).rejects.toMatchObject({ status: 404 });
  });
});
