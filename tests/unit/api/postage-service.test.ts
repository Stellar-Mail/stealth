import { describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import * as metrics from "../../../src/server/api/metrics";
import {
  assertPostageParticipant,
  getPostage,
  quotePostage,
  resolvePostage,
  submitPostage,
} from "../../../src/server/api/postage-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("postage service", () => {
  it("returns zero postage for explicitly allowed senders", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: true,
    });
    await repository.setSenderRule(recipient, sender, "allow");

    await expect(quotePostage(repository, { recipient, sender })).resolves.toMatchObject({
      amount: "0",
      eligible: true,
      trusted: true,
    });
  });

  it("marks blocked senders as ineligible", async () => {
    const repository = new MemoryApiRepository();
    await repository.setSenderRule(recipient, sender, "block");

    await expect(quotePostage(repository, { recipient, sender })).resolves.toMatchObject({
      eligible: false,
      reason: "sender_blocked",
    });
  });

  it("records pending postage once", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    const input = {
      amount: "125",
      messageId: "a".repeat(64),
      paymentHash: "b".repeat(64),
      recipient,
      sender,
    };

    await expect(
      submitPostage(repository, input, new Date("2026-06-14T12:00:00.000Z")),
    ).resolves.toMatchObject({
      createdAt: "2026-06-14T12:00:00.000Z",
      status: "pending",
    });
    await expect(submitPostage(repository, input)).rejects.toMatchObject({ status: 409 });
  });

  it("rejects postage below the mailbox minimum", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    await expect(
      submitPostage(repository, {
        amount: "99",
        messageId: "a".repeat(64),
        paymentHash: "b".repeat(64),
        recipient,
        sender,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("emits a metric when the account limit is exceeded", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    const spy = vi.spyOn(metrics, "incrementCounter");
    try {
      for (let i = 0; i < 50; i++) {
        await repository.incrementCounter(`abuse:account:${sender}`, 3600);
      }

      await expect(
        submitPostage(repository, {
          amount: "125",
          messageId: "g".repeat(64),
          paymentHash: "h".repeat(64),
          recipient,
          sender,
        }),
      ).rejects.toMatchObject({ status: 429 });
      expect(spy).toHaveBeenCalledWith(
        "postage_limit_rejected",
        expect.objectContaining({ limit: "account" }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("emits a metric when the ip limit is exceeded", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    const spy = vi.spyOn(metrics, "incrementCounter");
    try {
      for (let i = 0; i < 100; i++) {
        await repository.incrementCounter("abuse:ip:1.2.3.4", 3600);
      }

      await expect(
        submitPostage(
          repository,
          {
            amount: "125",
            messageId: "i".repeat(64),
            paymentHash: "j".repeat(64),
            recipient,
            sender,
          },
          new Date(),
          { ip: "1.2.3.4" },
        ),
      ).rejects.toMatchObject({ status: 429 });
      expect(spy).toHaveBeenCalledWith(
        "postage_limit_rejected",
        expect.objectContaining({ limit: "ip" }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("rate limits missing relay ids through the unknown relay bucket", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    for (let i = 0; i < 500; i++) {
      await repository.incrementCounter("abuse:relay:unknown", 3600);
    }

    await expect(
      submitPostage(repository, {
        amount: "125",
        messageId: "e".repeat(64),
        paymentHash: "f".repeat(64),
        recipient,
        sender,
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
      message: "Relay limit exceeded",
    });
  });

  it("limits postage reads to message participants", async () => {
    const repository = new MemoryApiRepository();
    const postage = await repository.setPostage({
      amount: "100",
      createdAt: "2026-06-14T12:00:00.000Z",
      messageId: "a".repeat(64),
      paymentHash: "b".repeat(64),
      recipient,
      sender,
      status: "pending",
    });

    await expect(getPostage(repository, postage.messageId)).resolves.toEqual(postage);
    expect(() => assertPostageParticipant(postage, sender)).not.toThrow();
    expect(() => assertPostageParticipant(postage, `G${"C".repeat(55)}`)).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("settles pending postage once", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPostage({
      amount: "100",
      createdAt: "2026-06-14T12:00:00.000Z",
      messageId: "a".repeat(64),
      paymentHash: "b".repeat(64),
      recipient,
      sender,
      status: "pending",
    });

    await expect(resolvePostage(repository, "a".repeat(64), "settled")).resolves.toMatchObject({
      status: "settled",
    });
    await expect(resolvePostage(repository, "a".repeat(64), "settled")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("marks rejected postage for refund", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPostage({
      amount: "100",
      createdAt: "2026-06-14T12:00:00.000Z",
      messageId: "c".repeat(64),
      paymentHash: "d".repeat(64),
      recipient,
      sender,
      status: "pending",
    });

    await expect(resolvePostage(repository, "c".repeat(64), "refunded")).resolves.toMatchObject({
      status: "refunded",
    });
  });
});
