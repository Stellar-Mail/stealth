import { beforeEach, describe, expect, it } from "vitest";

import { Route as SearchIndexRoute } from "../../../src/routes/api/v1/search/index";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import type { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { StoredEnvelope } from "../../../src/server/api/domain";

const ACTOR_A = "GDV4Z3O74NKQ5G7B5G5P7Z7Q7R7S7T7U7V7W7X7Y7Z7A7B7C7D7E7F7G";
const ACTOR_B = "GA7B7C7D7E7F7G7H7I7J7K7L7M7N7O7P7Q7R7S7T7U7V7W7X7Y7Z7A7B";

const searchHandler = (SearchIndexRoute.options as any).server?.handlers?.GET;

function request(path: string, actor?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== undefined) headers[ACTOR_HEADER] = actor;
  return new Request(`https://stealth.test${path}`, { method: "GET", headers });
}

function makeEnvelope(overrides: Partial<StoredEnvelope>): StoredEnvelope {
  return {
    messageId: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    senderId: ACTOR_B,
    recipientId: ACTOR_A,
    ciphertext: "dGVzdCBjaXBoZXJ0ZXh0",
    createdAt: new Date().toISOString(),
    protectedHeaders: {
      from: "alice@example.com",
      to: "bob@example.com",
      subject: "Test Subject",
    },
    status: "pending",
    ...overrides,
  };
}

describe("Search Routes API (Issue #1972 / BETA-065)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("rejects unauthorized requests with 401", async () => {
    const res = await searchHandler({
      request: request("/api/v1/search?q=test"),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("executes search for authenticated actor and scopes results strictly to the actor", async () => {
    // Insert message for Actor A
    await repo.insertEnvelope(
      makeEnvelope({
        messageId: "1111111111111111111111111111111111111111111111111111111111111111",
        recipientId: ACTOR_A,
        protectedHeaders: { subject: "Protocol Announcement" },
      }),
    );

    // Insert message for Actor B
    await repo.insertEnvelope(
      makeEnvelope({
        messageId: "2222222222222222222222222222222222222222222222222222222222222222",
        recipientId: ACTOR_B,
        senderId: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        protectedHeaders: { subject: "Protocol Announcement" },
      }),
    );

    // Request search as Actor A
    const res = await searchHandler({
      request: request("/api/v1/search?q=Protocol", ACTOR_A),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].id).toBe(
      "1111111111111111111111111111111111111111111111111111111111111111",
    );
    expect(body.data.indexLimitations.serverIndexLimited).toBe(true);
    expect(body.data.indexLimitations.encryptedBodyIndexed).toBe(false);
  });

  it("handles query filters via search params", async () => {
    await repo.insertEnvelope(
      makeEnvelope({
        messageId: "3333333333333333333333333333333333333333333333333333333333333333",
        recipientId: ACTOR_A,
        protectedHeaders: { subject: "Unread Invoice" },
        metadata: { mailbox: { folder: "inbox", unread: true } },
      }),
    );

    await repo.insertEnvelope(
      makeEnvelope({
        messageId: "4444444444444444444444444444444444444444444444444444444444444444",
        recipientId: ACTOR_A,
        protectedHeaders: { subject: "Read Invoice" },
        metadata: { mailbox: { folder: "inbox", unread: false } },
      }),
    );

    const res = await searchHandler({
      request: request("/api/v1/search?q=Invoice&unread=true&folder=inbox", ACTOR_A),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0].id).toBe(
      "3333333333333333333333333333333333333333333333333333333333333333",
    );
  });

  it("returns 422 on invalid query parameters", async () => {
    const res = await searchHandler({
      request: request("/api/v1/search?limit=-5", ACTOR_A),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
  });
});
