import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  OWNERSHIP_ACTIONS,
  OWNERSHIP_LIMITS,
  OwnershipGuardError,
  buildOwnershipTimeline,
  normalizeOwnershipAddress,
  normalizeOwnershipEvent,
  prepareOwnershipClaim,
  sanitizeOwnershipText,
  summarizeCurrentOwnership,
} from "../services/ownership-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../fixtures/sample-ownership-guard-inputs.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

test("sanitizes control characters and truncates bounded ownership text", () => {
  assert.equal(sanitizeOwnershipText("  hello\u0000 owner  ", "note"), "hello owner");
  assert.equal(sanitizeOwnershipText("abcdef", "note", { maxLength: 4 }), "abc…");
});

test("normalizes email-like ownership addresses", () => {
  assert.equal(normalizeOwnershipAddress("Alice@Team.Test", "ownerAddress"), "alice@team.test");
});

test("rejects malformed ownership addresses", () => {
  assert.throws(
    () => normalizeOwnershipAddress("not-an-address", "ownerAddress"),
    OwnershipGuardError,
  );
});

test("normalizes claim ownership events", () => {
  const event = normalizeOwnershipEvent(fixture.events[0]);

  assert.equal(event.action, OWNERSHIP_ACTIONS.CLAIMED);
  assert.equal(event.actorAddress, "alice@team.test");
  assert.equal(event.ownerAddress, "alice@team.test");
  assert.equal(event.occurredAt, "2026-06-23T09:00:00.000Z");
});

test("rejects unsupported ownership actions", () => {
  assert.throws(
    () => normalizeOwnershipEvent({ ...fixture.events[0], action: "archived" }),
    OwnershipGuardError,
  );
});

test("requires owner for claim and previous owner for reassignment", () => {
  assert.throws(
    () => normalizeOwnershipEvent({ ...fixture.events[0], ownerAddress: "" }),
    OwnershipGuardError,
  );
  assert.throws(
    () => normalizeOwnershipEvent({ ...fixture.events[1], previousOwnerAddress: "" }),
    OwnershipGuardError,
  );
});

test("builds chronological timeline after validation", () => {
  const timeline = buildOwnershipTimeline(fixture.events);

  assert.deepEqual(
    timeline.map((event) => event.eventId),
    [
      "own-event-005",
      "own-event-006",
      "own-event-003",
      "own-event-001",
      "own-event-004",
      "own-event-002",
    ],
  );
});

test("rejects oversized event batches before normalizing", () => {
  assert.throws(
    () => buildOwnershipTimeline(fixture.events, { maxEventsPerBatch: 2 }),
    OwnershipGuardError,
  );
});

test("summarizes current ownership by message", () => {
  const summary = summarizeCurrentOwnership(buildOwnershipTimeline(fixture.events));
  const byMessage = Object.fromEntries(summary.map((record) => [record.messageId, record]));

  assert.equal(byMessage["msg-owner-001"].ownerAddress, "riley@team.test");
  assert.equal(byMessage["msg-owner-001"].handoffCount, 1);
  assert.equal(byMessage["msg-owner-002"].ownerAddress, "jordan@team.test");
  assert.equal(byMessage["msg-owner-002"].escalationCount, 1);
  assert.equal(byMessage["msg-owner-003"].ownerAddress, "");
  assert.equal(byMessage["msg-owner-003"].lastAction, OWNERSHIP_ACTIONS.RELEASED);
});

test("prepares safe ownership claim drafts", () => {
  const claim = prepareOwnershipClaim(fixture.claimDraft);

  assert.equal(claim.messageId, "msg-owner-004");
  assert.equal(claim.actorAddress, "sam@team.test");
  assert.equal(claim.ownerAddress, "sam@team.test");
  assert.equal(claim.note, "Claiming from shared support queue.");
});

test("truncates oversized ownership notes", () => {
  const longNote = "a".repeat(OWNERSHIP_LIMITS.maxNoteLength + 20);
  const claim = prepareOwnershipClaim({ ...fixture.claimDraft, note: longNote });

  assert.equal(claim.note.length, OWNERSHIP_LIMITS.maxNoteLength);
});

test("fixture stays synthetic and avoids sensitive fields", async () => {
  const fixtureText = await readFile(fixturePath, "utf8");

  assert.equal(
    fixture.events.every((event) => event.sharedInboxAddress.toLowerCase().endsWith(".test")),
    true,
  );
  assert.doesNotMatch(fixtureText, /password|secret|token|bank|card|wallet|seed/i);
});
