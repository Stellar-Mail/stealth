import { beforeEach, describe, expect, it } from "vitest";

import { Route } from "../../../src/routes/api/v1/postage/$messageId";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

const patchHandler = (Route.options as any).server?.handlers?.PATCH;

function patchRequest(
  messageId: string,
  actor: string,
  operation: string,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    [ACTOR_HEADER]: actor,
    "content-type": "application/json",
  };
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  return new Request(`https://stealth.test/api/v1/postage/${messageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ operation }),
  });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string };
    data?: any;
  }>;
}

describe("postage lifecycle PATCH route (BETA-042)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  async function seedPostage(messageId: string, status: "pending" | "expired" = "pending") {
    await repo.setPostage({
      amount: "100",
      createdAt: "2026-06-14T12:00:00.000Z",
      messageId,
      paymentHash: "b".repeat(64),
      recipient,
      sender,
      status,
    });
  }

  it("disputes postage as the recipient", async () => {
    const messageId = "a".repeat(64);
    await seedPostage(messageId);

    const res = await patchHandler({
      request: patchRequest(messageId, recipient, "dispute"),
      params: { messageId },
    });
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.data.status).toBe("disputed");
  });

  it("rejects dispute by the sender", async () => {
    const messageId = "b".repeat(64);
    await seedPostage(messageId);

    const res = await patchHandler({
      request: patchRequest(messageId, sender, "dispute"),
      params: { messageId },
    });
    expect(res.status).toBe(403);
    expect((await parseJson(res)).error?.code).toBe("forbidden");
  });

  it("allows either participant to expire postage", async () => {
    const messageId = "c".repeat(64);
    await seedPostage(messageId);

    for (const actor of [recipient, sender]) {
      const res = await patchHandler({
        request: patchRequest(messageId, actor, "expire"),
        params: { messageId },
      });
      expect(res.status).toBe(200);
      expect((await parseJson(res)).data.status).toBe("expired");
    }
  });

  it("reclaims postage as the sender", async () => {
    const messageId = "d".repeat(64);
    await seedPostage(messageId, "expired");

    const res = await patchHandler({
      request: patchRequest(messageId, sender, "reclaim"),
      params: { messageId },
    });
    expect(res.status).toBe(200);
    expect((await parseJson(res)).data.status).toBe("reclaimed");
  });

  it("rejects reclaim by the recipient", async () => {
    const messageId = "e".repeat(64);
    await seedPostage(messageId, "expired");

    const res = await patchHandler({
      request: patchRequest(messageId, recipient, "reclaim"),
      params: { messageId },
    });
    expect(res.status).toBe(403);
  });

  it("requires an authenticated actor", async () => {
    const messageId = "f".repeat(64);
    await seedPostage(messageId);

    const res = await patchHandler({
      request: patchRequest(messageId, "", "settle"),
      params: { messageId },
    });
    expect(res.status).toBe(401);
  });

  it("caches and replays a terminal-state conflict under the same idempotency key", async () => {
    const messageId = "f".repeat(64);
    await seedPostage(messageId);
    const key = "patch-lifecycle-001";

    // Settle once (off-chain path in tests).
    const first = await patchHandler({
      request: patchRequest(messageId, recipient, "settle", key),
      params: { messageId },
    });
    expect(first.status).toBe(200);

    // A second settle under the SAME key replays the cached 200 (idempotent
    // replay) and never re-submits — value cannot move twice.
    const second = await patchHandler({
      request: patchRequest(messageId, recipient, "settle", key),
      params: { messageId },
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("x-idempotency-replayed")).toBe("true");
    const replayedBody = await parseJson(second);
    expect(replayedBody.data.status).toBe("settled");

    // A fresh request (no key) against the now-settled record yields the same
    // deterministic 409 conflict the service layer guarantees.
    const third = await patchHandler({
      request: patchRequest(messageId, recipient, "settle"),
      params: { messageId },
    });
    expect(third.status).toBe(409);
    const body = await parseJson(third);
    expect(body.error?.code).toBe("conflict");
    expect(body.error?.message).toContain("already been settled");
  });
});
