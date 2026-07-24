import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { createDeliveryReceipt } from "../../../src/server/api/receipt-service";

// Stable test fixtures — Stellar G-addresses (56 chars starting with G)
const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const outsider = `G${"C".repeat(55)}`;
const messageId = "a".repeat(64);

async function repoWithReceipt() {
  const repo = new MemoryApiRepository();
  await createDeliveryReceipt(repo, { messageId, recipient, sender });
  return repo;
}

describe("markReceiptRead — atomic read-receipt publication (#1497)", () => {
  // -------------------------------------------------------------------------
  // Not-found / authorization
  // -------------------------------------------------------------------------

  it("returns not-found when no receipt exists", async () => {
    const repo = new MemoryApiRepository();
    await expect(repo.markReceiptRead(messageId, recipient)).resolves.toEqual({
      outcome: "not-found",
    });
  });

  it("returns forbidden when the actor is not a message participant", async () => {
    const repo = await repoWithReceipt();
    await expect(repo.markReceiptRead(messageId, outsider)).resolves.toEqual({
      outcome: "forbidden",
    });
  });

  it("does not modify receipt state when actor is forbidden", async () => {
    const repo = await repoWithReceipt();
    await repo.markReceiptRead(messageId, outsider);
    // readAt must still be null — forbidden calls must not write
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({ readAt: null });
  });

  // -------------------------------------------------------------------------
  // First valid transition — recipient actor
  // -------------------------------------------------------------------------

  it("sets readAt atomically on the first valid call (recipient actor)", async () => {
    const repo = await repoWithReceipt();
    const now = new Date("2026-06-14T12:30:00.000Z");
    const result = await repo.markReceiptRead(messageId, recipient, now);

    expect(result).toEqual({
      outcome: "marked",
      receipt: expect.objectContaining({ readAt: "2026-06-14T12:30:00.000Z" }),
    });
  });

  it("sets readAt atomically on the first valid call (sender actor)", async () => {
    const repo = await repoWithReceipt();
    const now = new Date("2026-06-14T09:00:00.000Z");
    const result = await repo.markReceiptRead(messageId, sender, now);

    expect(result).toEqual({
      outcome: "marked",
      receipt: expect.objectContaining({ readAt: "2026-06-14T09:00:00.000Z" }),
    });
  });

  it("persists the readAt timestamp so getReceipt reflects the change", async () => {
    const repo = await repoWithReceipt();
    const now = new Date("2026-06-14T12:30:00.000Z");
    await repo.markReceiptRead(messageId, recipient, now);

    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      readAt: "2026-06-14T12:30:00.000Z",
    });
  });

  // -------------------------------------------------------------------------
  // Duplicate-call policy — first-write-wins
  // -------------------------------------------------------------------------

  it("returns already-read with the original timestamp on a duplicate call", async () => {
    const repo = await repoWithReceipt();
    const firstTime = new Date("2026-06-14T12:30:00.000Z");
    const secondTime = new Date("2026-06-14T13:00:00.000Z");

    await repo.markReceiptRead(messageId, recipient, firstTime);
    const duplicate = await repo.markReceiptRead(messageId, recipient, secondTime);

    expect(duplicate).toEqual({
      outcome: "already-read",
      readAt: "2026-06-14T12:30:00.000Z", // canonical — first write wins
    });
  });

  it("does not overwrite the stored timestamp on repeated calls", async () => {
    const repo = await repoWithReceipt();
    await repo.markReceiptRead(messageId, recipient, new Date("2026-06-14T12:30:00.000Z"));
    await repo.markReceiptRead(messageId, sender, new Date("2026-06-14T13:00:00.000Z"));

    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      readAt: "2026-06-14T12:30:00.000Z",
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency — only one winner under simultaneous calls
  // -------------------------------------------------------------------------

  it("allows exactly one winner out of concurrent markReceiptRead calls", async () => {
    const repo = await repoWithReceipt();

    // Fan out 8 concurrent calls — all racing to set readAt for the first time
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        repo.markReceiptRead(messageId, recipient, new Date(`2026-06-14T12:00:0${i}.000Z`)),
      ),
    );

    const marked = results.filter((r) => r.outcome === "marked");
    const alreadyRead = results.filter((r) => r.outcome === "already-read");

    // Exactly one call must win
    expect(marked).toHaveLength(1);
    // All other calls observe the canonical timestamp
    expect(alreadyRead).toHaveLength(7);

    // Every already-read response must carry the same canonical timestamp
    const canonicalTimestamp = (marked[0] as { outcome: "marked"; receipt: { readAt: string } })
      .receipt.readAt;
    for (const r of alreadyRead) {
      expect((r as { outcome: "already-read"; readAt: string }).readAt).toBe(canonicalTimestamp);
    }

    // Storage reflects the single canonical timestamp
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      readAt: canonicalTimestamp,
    });
  });

  it("returns a defensive structural clone so caller mutation cannot corrupt stored state", async () => {
    const repo = await repoWithReceipt();
    const result = await repo.markReceiptRead(messageId, recipient, new Date());

    if (result.outcome !== "marked") throw new Error("Expected marked");

    // Mutate the returned receipt object
    (result.receipt as { readAt: string | null }).readAt = null;

    // The stored record must be unaffected
    await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
      readAt: expect.any(String),
    });
  });
});
