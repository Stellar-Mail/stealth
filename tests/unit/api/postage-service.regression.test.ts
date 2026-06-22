import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { getPostage, quotePostage, submitPostage } from "../../../src/server/api/postage-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("postage service regression coverage", () => {
  it("quotes the mailbox minimum for unknown senders", async () => {
    const repository = new MemoryApiRepository();
    await repository.setPolicy(recipient, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });

    await expect(quotePostage(repository, { recipient, sender })).resolves.toMatchObject({
      amount: "100",
      eligible: true,
      reason: "mailbox_minimum",
      trusted: false,
    });
  });

  it("rejects submissions from blocked senders", async () => {
    const repository = new MemoryApiRepository();
    await repository.setSenderRule(recipient, sender, "block");

    await expect(
      submitPostage(repository, {
        amount: "100",
        messageId: "a".repeat(64),
        paymentHash: "b".repeat(64),
        recipient,
        sender,
      }),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("returns not found for unknown postage", async () => {
    const repository = new MemoryApiRepository();

    await expect(getPostage(repository, "a".repeat(64))).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });
});
