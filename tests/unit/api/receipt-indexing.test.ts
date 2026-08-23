import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { indexReceiptEvents } from "../../../src/server/api/job-service";
import type { ReceiptEvent } from "../../../src/server/api/domain";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId1 = "1".repeat(64);
const messageId2 = "2".repeat(64);
const messageId3 = "3".repeat(64);

describe("receipt event indexing and checkpointing", () => {
  it("indexes events in sequence order and creates durable checkpoint", async () => {
    const repository = new MemoryApiRepository();
    const events: ReceiptEvent[] = [
      {
        eventId: "evt-1",
        streamId: "stream-a",
        sequence: 0,
        messageId: messageId1,
        recipient,
        sender,
        deliveredAt: "2026-08-18T10:00:00.000Z",
      },
      {
        eventId: "evt-2",
        streamId: "stream-a",
        sequence: 1,
        messageId: messageId2,
        recipient,
        sender,
        deliveredAt: "2026-08-18T10:01:00.000Z",
      },
    ];

    const result = await indexReceiptEvents(repository, "stream-a", events);
    expect(result.indexedCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
    expect(result.gapsDetected).toBe(0);
    expect(result.checkpoint.lastSequence).toBe(1);
    expect(result.checkpoint.processedCount).toBe(2);

    const cp = await repository.getReceiptCheckpoint("stream-a");
    expect(cp).toEqual(result.checkpoint);
  });

  it("suppresses duplicate events with sequence <= lastSequence", async () => {
    const repository = new MemoryApiRepository();
    const events: ReceiptEvent[] = [
      {
        eventId: "evt-1",
        streamId: "stream-a",
        sequence: 0,
        messageId: messageId1,
        recipient,
        sender,
        deliveredAt: "2026-08-18T10:00:00.000Z",
      },
    ];

    await indexReceiptEvents(repository, "stream-a", events);

    // Replay identical event without rewind option
    const replay = await indexReceiptEvents(repository, "stream-a", events, new Date(), {
      allowRewind: false,
    });
    expect(replay.indexedCount).toBe(0);
    expect(replay.duplicateCount).toBe(1);
    expect(replay.checkpoint.lastSequence).toBe(0);
  });

  it("handles bounded rewind gracefully and updates checkpoint", async () => {
    const repository = new MemoryApiRepository();
    const events: ReceiptEvent[] = [
      {
        eventId: "evt-1",
        streamId: "stream-a",
        sequence: 0,
        messageId: messageId1,
        recipient,
        sender,
        deliveredAt: "2026-08-18T10:00:00.000Z",
      },
      {
        eventId: "evt-2",
        streamId: "stream-a",
        sequence: 5,
        messageId: messageId2,
        recipient,
        sender,
        deliveredAt: "2026-08-18T10:05:00.000Z",
      },
    ];

    await indexReceiptEvents(repository, "stream-a", events);

    // Rewind event with sequence 4
    const rewindEvent: ReceiptEvent = {
      eventId: "evt-3",
      streamId: "stream-a",
      sequence: 4,
      messageId: messageId3,
      recipient,
      sender,
      deliveredAt: "2026-08-18T10:04:00.000Z",
    };

    const rewindResult = await indexReceiptEvents(
      repository,
      "stream-a",
      [rewindEvent],
      new Date(),
      {
        allowRewind: true,
        maxRewindLimit: 10,
      },
    );

    expect(rewindResult.rewindCount).toBeGreaterThan(0);
    expect(rewindResult.indexedCount).toBe(1);
    expect(rewindResult.checkpoint.lastSequence).toBe(4);
  });
});
