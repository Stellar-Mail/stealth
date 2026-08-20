import { beforeEach, describe, expect, it } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import { Route as MailboxMessageIdRoute } from "@/routes/api/v1/mailbox/$messageId";
import { type StoredEnvelope } from "@/server/api/domain";

const messageHandlers = MailboxMessageIdRoute.options.server!.handlers as any as {
  GET: (ctx: { request: Request; params: { messageId: string } }) => Promise<Response>;
};

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const MSG1 = "1111111111111111111111111111111111111111111111111111111111111111";

function makeEnvelope(overrides: Partial<StoredEnvelope> = {}): StoredEnvelope {
  return {
    messageId: MSG1,
    senderId: BOB,
    recipientId: ALICE,
    ciphertext: "aGVsbG8=",
    protectedHeaders: {
      alg: "dir",
      enc: "A256GCM",
      version: "v1",
      subject: "Live thread",
    },
    createdAt: "2026-08-20T10:00:00.000Z",
    status: "pending",
    metadata: {
      payload: { version: "v1", sender: BOB, recipient: ALICE },
      signature: { scheme: "Ed25519", value: "ab" },
    },
    ...overrides,
  };
}

describe("Mailbox sealed message GET (BETA-055)", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    process.env.STEALTH_CURSOR_SECRET = "test-cursor-secret-12345678901234567890";
    repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;
  });

  it("returns ciphertext and payload to the recipient and forbids other actors", async () => {
    await repository.insertEnvelope(makeEnvelope());

    const allowed = await messageHandlers.GET({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        headers: { "x-stealth-address": ALICE },
      }),
      params: { messageId: MSG1 },
    });
    const json = await allowed.json();
    expect(allowed.status).toBe(200);
    expect(json.data.ciphertext).toBe("aGVsbG8=");
    expect(json.data.payload).toMatchObject({ sender: BOB, recipient: ALICE });
    expect(json.data.protectedHeaders.subject).toBe("Live thread");

    const forbidden = await messageHandlers.GET({
      request: new Request(`http://localhost/api/v1/mailbox/${MSG1}`, {
        headers: { "x-stealth-address": BOB },
      }),
      params: { messageId: MSG1 },
    });
    expect(forbidden.status).toBe(403);
  });
});
