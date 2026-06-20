import { describe, expect, it } from "vitest";
import { FIXTURE_OWNERSHIP_EVENTS } from "../fixtures/ownership.fixture";
import {
  MAX_HISTORY_LIMIT,
  MAX_NOTE_LENGTH,
  MAX_REASON_LENGTH,
  appendOwnershipEvent,
  createOwnershipEvent,
  getCurrentOwnerId,
  getOwnershipHistoryForThread,
  isValidIdentifier,
  sanitizeText,
  summarizeOwnership,
  validateOwnershipEventInput,
} from "../services/ownership.service";

describe("identifier validation", () => {
  it("accepts normalized safe identifiers", () => {
    expect(isValidIdentifier("Thread-100")).toBe(true);
    expect(isValidIdentifier("agent.alice")).toBe(true);
  });

  it("rejects empty, single-character, and hostile identifiers", () => {
    expect(isValidIdentifier("")).toBe(false);
    expect(isValidIdentifier("a")).toBe(false);
    expect(isValidIdentifier("../thread")).toBe(false);
    expect(isValidIdentifier("<script>")).toBe(false);
  });
});

describe("sanitizeText", () => {
  it("removes control characters and collapses whitespace", () => {
    expect(sanitizeText("  transfer\u0000\n\nbecause\turgent  ", MAX_REASON_LENGTH)).toBe(
      "transfer because urgent",
    );
  });

  it("bounds text to the requested length", () => {
    expect(sanitizeText("x".repeat(MAX_NOTE_LENGTH + 20), MAX_NOTE_LENGTH)).toHaveLength(
      MAX_NOTE_LENGTH,
    );
  });
});

describe("validateOwnershipEventInput", () => {
  it("returns no errors for a valid event", () => {
    expect(
      validateOwnershipEventInput({
        threadId: "thread-300",
        ownerId: "agent-dana",
        actorId: "lead-marta",
        action: "assigned",
        createdAt: "2026-06-20T12:00:00.000Z",
      }),
    ).toEqual([]);
  });

  it("reports malformed identifiers and unsupported actions", () => {
    const errors = validateOwnershipEventInput({
      threadId: "<bad>",
      ownerId: "",
      actorId: "../actor",
      action: "assigned",
    });
    expect(errors.map((error) => error.field)).toEqual(["threadId", "ownerId", "actorId"]);
  });

  it("rejects non-ISO timestamps", () => {
    const errors = validateOwnershipEventInput({
      threadId: "thread-300",
      ownerId: "agent-dana",
      actorId: "lead-marta",
      action: "assigned",
      createdAt: "20 June 2026",
    });
    expect(errors).toContainEqual({
      field: "createdAt",
      message: "createdAt must be an ISO-8601 timestamp.",
    });
  });
});

describe("createOwnershipEvent", () => {
  it("normalizes ids and sanitizes reason and note", () => {
    const event = createOwnershipEvent({
      threadId: " Thread-300 ",
      ownerId: " Agent-Dana ",
      actorId: " Lead-Marta ",
      action: "assigned",
      reason: "  Queue\u0000pickup ",
      note: "  Needs\nreview ",
      createdAt: "2026-06-20T12:00:00.000Z",
    });

    expect(event.threadId).toBe("thread-300");
    expect(event.ownerId).toBe("agent-dana");
    expect(event.actorId).toBe("lead-marta");
    expect(event.reason).toBe("Queue pickup");
    expect(event.note).toBe("Needs review");
  });

  it("throws on invalid input instead of storing malformed events", () => {
    expect(() =>
      createOwnershipEvent({
        threadId: "x",
        ownerId: "agent-dana",
        actorId: "lead-marta",
        action: "claimed",
      }),
    ).toThrow("threadId");
  });

  it("bounds reason length", () => {
    const event = createOwnershipEvent({
      threadId: "thread-300",
      ownerId: "agent-dana",
      actorId: "lead-marta",
      action: "claimed",
      reason: "r".repeat(MAX_REASON_LENGTH + 25),
      createdAt: "2026-06-20T12:00:00.000Z",
    });
    expect(event.reason).toHaveLength(MAX_REASON_LENGTH);
  });
});

describe("ownership history", () => {
  it("appends without mutating caller-provided arrays", () => {
    const before = [...FIXTURE_OWNERSHIP_EVENTS];
    const next = appendOwnershipEvent(FIXTURE_OWNERSHIP_EVENTS, {
      threadId: "thread-100",
      ownerId: "agent-dana",
      actorId: "lead-marta",
      action: "transferred",
      createdAt: "2026-06-20T12:00:00.000Z",
    });

    expect(FIXTURE_OWNERSHIP_EVENTS).toEqual(before);
    expect(next).toHaveLength(FIXTURE_OWNERSHIP_EVENTS.length + 1);
  });

  it("returns newest events first for a thread", () => {
    const history = getOwnershipHistoryForThread(FIXTURE_OWNERSHIP_EVENTS, "THREAD-100");
    expect(history.map((event) => event.ownerId)).toEqual(["agent-bob", "agent-alice"]);
  });

  it("respects explicit and maximum history limits", () => {
    const manyEvents = Array.from({ length: MAX_HISTORY_LIMIT + 10 }, (_, index) =>
      createOwnershipEvent({
        threadId: "thread-big",
        ownerId: `agent-${index}`,
        actorId: "lead-marta",
        action: "assigned",
        createdAt: new Date(Date.UTC(2026, 5, 20, 12, 0, index)).toISOString(),
      }),
    );

    expect(getOwnershipHistoryForThread(manyEvents, "thread-big", 3)).toHaveLength(3);
    expect(getOwnershipHistoryForThread(manyEvents, "thread-big", 9999)).toHaveLength(
      MAX_HISTORY_LIMIT,
    );
  });

  it("returns null current owner when latest action releases ownership", () => {
    const events = appendOwnershipEvent(FIXTURE_OWNERSHIP_EVENTS, {
      threadId: "thread-100",
      ownerId: "agent-bob",
      actorId: "agent-bob",
      action: "released",
      createdAt: "2026-06-20T13:00:00.000Z",
    });

    expect(getCurrentOwnerId(events, "thread-100")).toBeNull();
  });

  it("summarizes ownership for a thread", () => {
    expect(summarizeOwnership(FIXTURE_OWNERSHIP_EVENTS, "thread-100")).toEqual({
      threadId: "thread-100",
      currentOwnerId: "agent-bob",
      eventCount: 2,
      latestAction: "transferred",
      latestAt: "2026-06-20T10:00:00.000Z",
    });
  });
});
