import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  createSenderRequest,
  decideSenderRequest,
} from "../../../src/server/api/sender-request-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const otherRecipient = `G${"C".repeat(55)}`;

function pendingRequest(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    requestId: "00000000-0000-4000-8000-000000000001",
    recipient,
    sender,
    message: {
      messageId: "a".repeat(64),
      ciphertextHash: "b".repeat(64),
    },
    createdAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 86_400_000).toISOString(),
    status: "pending" as const,
    ...overrides,
  };
}

describe("sender request service", () => {
  it("creates idempotently and applies an approve-once decision exactly once", async () => {
    const repository = new MemoryApiRepository();
    const request = pendingRequest();

    expect(await createSenderRequest(repository, request)).toMatchObject({
      created: true,
      request,
    });
    expect(await createSenderRequest(repository, request)).toMatchObject({
      created: false,
      request,
    });

    const approved = await decideSenderRequest(
      repository,
      request.requestId,
      recipient,
      "approve_once",
    );
    expect(approved).toMatchObject({ status: "approved", decision: "approve_once" });
    await expect(
      decideSenderRequest(repository, request.requestId, recipient, "reject"),
    ).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
  });

  it("persists sender rules for always-allow and block decisions", async () => {
    const repository = new MemoryApiRepository();
    const allowed = pendingRequest();
    const blocked = pendingRequest({ requestId: "00000000-0000-4000-8000-000000000002" });
    await createSenderRequest(repository, allowed);
    await createSenderRequest(repository, blocked);

    await decideSenderRequest(repository, allowed.requestId, recipient, "always_allow");
    expect(await repository.getSenderRule(recipient, sender)).toBe("allow");

    await decideSenderRequest(repository, blocked.requestId, recipient, "block");
    expect(await repository.getSenderRule(recipient, sender)).toBe("block");
  });

  it("does not disclose requests to another recipient", async () => {
    const repository = new MemoryApiRepository();
    const request = pendingRequest();
    await createSenderRequest(repository, request);

    await expect(
      decideSenderRequest(repository, request.requestId, otherRecipient, "reject"),
    ).rejects.toEqual(expect.objectContaining({ status: 404, code: "not_found" }));
  });
});
