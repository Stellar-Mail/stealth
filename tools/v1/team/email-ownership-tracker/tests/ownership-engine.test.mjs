import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LIMITS,
  OwnershipEngineError,
  buildOwnershipLedger,
  createOwnershipEngine,
  createOwnershipState,
  normalizeEmail,
  normalizeId,
  normalizeOwnershipEvent,
} from "../core/ownership-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "ownership-engine-cases.json"), "utf8"),
);

function claim(overrides = {}) {
  return {
    eventId: "evt-test-001",
    messageId: "msg-test-001@example.test",
    action: "claim",
    actorEmail: "owner@example.test",
    ownerEmail: "owner@example.test",
    createdAt: "2026-07-01T09:00:00.000Z",
    reason: "Initial claim",
    ...overrides,
  };
}

describe("normalizers", () => {
  it("normalizes safe ids and rejects unsafe ids", () => {
    assert.equal(normalizeId(" msg-001@example.test ", "messageId"), "msg-001@example.test");
    assert.throws(() => normalizeId("../private", "messageId"), OwnershipEngineError);
    assert.throws(
      () => normalizeId("a".repeat(LIMITS.MAX_MESSAGE_ID_LENGTH + 1), "messageId"),
      OwnershipEngineError,
    );
  });

  it("normalizes safe emails and rejects injected emails", () => {
    assert.equal(normalizeEmail(" Owner@Example.Test "), "owner@example.test");
    assert.throws(
      () => normalizeEmail("owner@example.test\r\nBcc: x@example.test"),
      OwnershipEngineError,
    );
  });

  it("normalizes ownership events", () => {
    const event = normalizeOwnershipEvent(
      claim({ ownerEmail: "Owner@Example.Test", subject: "<b>Hello</b>" }),
    );
    assert.equal(event.ownerEmail, "owner@example.test");
    assert.equal(event.subject, "Hello");
    assert.equal(event.createdAt, "2026-07-01T09:00:00.000Z");
  });

  it("rejects non-UTC timestamp shapes", () => {
    assert.throws(
      () => normalizeOwnershipEvent(claim({ createdAt: "2026-07-01" })),
      OwnershipEngineError,
    );
  });

  it("rejects fixture invalid events with stable error codes", () => {
    for (const entry of fixture.invalidEvents) {
      assert.throws(
        () => normalizeOwnershipEvent(entry.event),
        (error) => error instanceof OwnershipEngineError && error.code === entry.code,
      );
    }
  });
});

describe("buildOwnershipLedger", () => {
  it("derives active owners and conflicts from fixture history", () => {
    const ledger = buildOwnershipLedger(fixture.events);

    assert.equal(ledger.status, "ready");
    assert.equal(ledger.summary.totalEvents, 5);
    assert.equal(ledger.summary.activeOwners, 1);
    assert.equal(ledger.summary.conflicts, 1);
    assert.equal(ledger.activeOwners[0].messageId, "msg-002@example.test");
    assert.equal(ledger.activeOwners[0].ownerEmail, "dana@example.test");
    assert.equal(ledger.conflicts[0].code, "already-owned");
  });

  it("treats duplicate claims by the same owner as applied history", () => {
    const ledger = buildOwnershipLedger([
      claim({ eventId: "evt-1" }),
      claim({ eventId: "evt-2", createdAt: "2026-07-01T09:01:00.000Z" }),
    ]);

    assert.equal(ledger.summary.conflicts, 0);
    assert.equal(ledger.activeOwners[0].history.length, 2);
  });

  it("records release and transfer conflicts without changing the current owner", () => {
    const ledger = buildOwnershipLedger([
      claim({ eventId: "evt-1", ownerEmail: "owner@example.test" }),
      claim({
        eventId: "evt-2",
        action: "release",
        actorEmail: "other@example.test",
        ownerEmail: "other@example.test",
        createdAt: "2026-07-01T09:01:00.000Z",
      }),
      claim({
        eventId: "evt-3",
        action: "transfer",
        actorEmail: "other@example.test",
        ownerEmail: "other@example.test",
        nextOwnerEmail: "next@example.test",
        createdAt: "2026-07-01T09:02:00.000Z",
      }),
    ]);

    assert.equal(ledger.summary.conflicts, 2);
    assert.equal(ledger.activeOwners[0].ownerEmail, "owner@example.test");
  });

  it("rejects non-array and oversized histories", () => {
    assert.throws(() => buildOwnershipLedger(null), OwnershipEngineError);
    assert.throws(
      () => buildOwnershipLedger(new Array(LIMITS.MAX_EVENTS + 1).fill(claim())),
      OwnershipEngineError,
    );
  });
});

describe("createOwnershipState", () => {
  it("maps loading, empty, ready, and error states", () => {
    assert.equal(createOwnershipState(null, { loading: true }).status, "loading");
    assert.equal(createOwnershipState(buildOwnershipLedger([])).status, "empty");
    assert.equal(createOwnershipState(buildOwnershipLedger([claim()])).status, "ready");

    const errorState = createOwnershipState(null, {
      error: new OwnershipEngineError("bad-input", "Bad input"),
    });
    assert.equal(errorState.status, "error");
    assert.equal(errorState.code, "bad-input");
  });

  it("returns defensive copies for ready state", () => {
    const ready = createOwnershipState(buildOwnershipLedger([claim()]));
    ready.activeOwners[0].ownerEmail = "mutated@example.test";

    const next = createOwnershipState(buildOwnershipLedger([claim()]));
    assert.equal(next.activeOwners[0].ownerEmail, "owner@example.test");
  });
});

describe("createOwnershipEngine", () => {
  it("provides a deterministic folder-local service surface", () => {
    const engine = createOwnershipEngine([], {
      now: () => "2026-07-01T10:00:00.000Z",
      idPrefix: "test-event",
    });

    engine.claim("msg-1@example.test", "alice@example.test", { subject: "First" });
    engine.transfer("msg-1@example.test", "alice@example.test", "bob@example.test");

    const events = engine.listEvents();
    const ledger = engine.getLedger();

    assert.equal(events[0].eventId, "test-event-001");
    assert.equal(events[1].eventId, "test-event-002");
    assert.equal(ledger.status, "ready");
    assert.equal(ledger.activeOwners[0].ownerEmail, "bob@example.test");
  });

  it("keeps event storage private by returning copies", () => {
    const engine = createOwnershipEngine([claim()]);
    const events = engine.listEvents();
    events[0].ownerEmail = "mutated@example.test";

    assert.equal(engine.listEvents()[0].ownerEmail, "owner@example.test");
  });
});
