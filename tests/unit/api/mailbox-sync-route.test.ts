import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleMailboxSync } from "../../../src/services/relay/mailbox-sync-transport";
import { MailboxSyncService } from "../../../src/services/relay/mailbox-sync-service";
import { MemoryMailboxSyncPersistence } from "../../../src/services/relay/memory-mailbox-sync";
import { encodeMailboxCursor } from "../../../src/services/relay/mailbox-cursor";

const SECRET = "test-mailbox-cursor-secret";
const owner = `G${"A".repeat(55)}`;
const other = `G${"C".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const deviceId = "device-one";

function messageId(n: number): string {
  return n.toString(16).padStart(64, "0");
}

function syncRequest(actor: string, body: Record<string, unknown>) {
  return new Request("https://stealth.test/api/v1/mailbox/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-stealth-address": actor,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/mailbox/sync", () => {
  let persistence: MemoryMailboxSyncPersistence;
  let service: MailboxSyncService;

  beforeEach(async () => {
    process.env.STEALTH_CURSOR_SECRET = SECRET;
    persistence = new MemoryMailboxSyncPersistence();
    service = new MailboxSyncService(persistence, { now: () => 1_000 });
    await persistence.appendEvent({
      type: "upsert",
      messageId: messageId(1),
      recipient: owner,
      sender,
      occurredAt: "2026-08-19T00:00:00.000Z",
      ciphertext: "aGVsbG8=",
    });
  });

  afterEach(() => {
    delete process.env.STEALTH_CURSOR_SECRET;
  });

  it("returns 401 without an actor", async () => {
    const request = new Request("https://stealth.test/api/v1/mailbox/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    const response = await handleMailboxSync(request, service);
    expect(response.status).toBe(401);
  });

  it("returns initial events for the authenticated mailbox owner", async () => {
    const response = await handleMailboxSync(syncRequest(owner, { deviceId }), service);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.mode).toBe("initial");
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0].ciphertext).toBe("aGVsbG8=");
    expect(JSON.stringify(body)).not.toContain("STEALTH_CURSOR_SECRET");
  });

  it("does not leak another mailbox's events to a different actor", async () => {
    const response = await handleMailboxSync(syncRequest(other, { deviceId }), service);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.events).toEqual([]);
  });

  it("returns 410 for an expired cursor", async () => {
    const expired = encodeMailboxCursor(owner, deviceId, 1, 1, 10);
    const lateService = new MailboxSyncService(persistence, { now: () => 10_000 });
    const response = await handleMailboxSync(
      syncRequest(owner, { deviceId, cursor: expired }),
      lateService,
    );
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "cursor_expired" },
    });
  });

  it("returns 422 for malformed input", async () => {
    const response = await handleMailboxSync(syncRequest(owner, { deviceId: "bad id" }), service);
    expect(response.status).toBe(422);
  });

  it("is idempotent: repeating the same cursor does not duplicate events", async () => {
    const first = await handleMailboxSync(syncRequest(owner, { deviceId }), service);
    const firstBody = await first.json();
    const second = await handleMailboxSync(
      syncRequest(owner, { deviceId, cursor: firstBody.data.cursor }),
      service,
    );
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.data.mode).toBe("delta");
    expect(secondBody.data.events).toEqual([]);
  });
});
