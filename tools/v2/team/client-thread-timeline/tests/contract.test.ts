/**
 * contract.test.ts — Client Thread Timeline (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, grouping,
 * chronological ordering, and edge cases (empty input, unknown thread,
 * multiple clients). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createTimelineContract } from "../services/timeline.service";
import {
  TimelineErrorCode,
  buildClientTimeline,
  getClientThread,
  ok,
  fail,
  type TimelineContractOutput,
  type TimelineResult,
} from "../contract";
import { TIMELINE_FIXTURES, ACME_MESSAGES, EMPTY_MESSAGES } from "../fixtures";

describe("timeline contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(TimelineErrorCode.NotFound, "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(TimelineErrorCode.NotFound);
      expect(r.message).toBe("missing");
    }
  });
});

describe("timeline contract — buildTimeline", () => {
  it("groups messages by thread for the requested client", () => {
    const contract = createTimelineContract();
    const res = contract.execute({
      operation: "buildTimeline",
      input: { clientId: "client-acme", messages: TIMELINE_FIXTURES },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "buildTimeline") {
      const { timeline } = res.value;
      expect(timeline.clientId).toBe("client-acme");
      // client-globex messages are excluded
      expect(timeline.threads.length).toBe(2);
      expect(timeline.totalMessages).toBe(ACME_MESSAGES.length);
      const threadIds = timeline.threads.map((t) => t.threadId).sort();
      expect(threadIds).toEqual(["thread-billing", "thread-onboarding"]);
    }
  });

  it("orders messages within a thread chronologically (asc default)", () => {
    const contract = createTimelineContract();
    const res = contract.execute({
      operation: "buildTimeline",
      input: { clientId: "client-acme", messages: TIMELINE_FIXTURES },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "buildTimeline") {
      const onboarding = res.value.timeline.threads.find((t) => t.threadId === "thread-onboarding");
      expect(onboarding?.messages.map((m) => m.id)).toEqual(["m-1", "m-3"]);
    }
  });

  it("honors desc ordering when requested", () => {
    const timeline = buildClientTimeline(
      { clientId: "client-acme", messages: TIMELINE_FIXTURES },
      "desc",
    );
    const onboarding = timeline.threads.find((t) => t.threadId === "thread-onboarding");
    expect(onboarding?.messages.map((m) => m.id)).toEqual(["m-3", "m-1"]);
  });

  it("returns an empty timeline for a client with no messages", () => {
    const contract = createTimelineContract();
    const res = contract.execute({
      operation: "buildTimeline",
      input: { clientId: "client-unknown", messages: EMPTY_MESSAGES },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "buildTimeline") {
      expect(res.value.timeline.threads).toEqual([]);
      expect(res.value.timeline.totalMessages).toBe(0);
    }
  });
});

describe("timeline contract — getThread", () => {
  it("returns the requested thread ordered by time", () => {
    const contract = createTimelineContract();
    const res = contract.execute({
      operation: "getThread",
      input: {
        clientId: "client-acme",
        threadId: "thread-onboarding",
        messages: TIMELINE_FIXTURES,
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "getThread") {
      expect(res.value.thread.messages.map((m) => m.id)).toEqual(["m-1", "m-3"]);
    }
  });

  it("returns NotFound for an unknown thread (no throw)", () => {
    const contract = createTimelineContract();
    const res: TimelineResult<TimelineContractOutput> = contract.execute({
      operation: "getThread",
      input: {
        clientId: "client-acme",
        threadId: "thread-does-not-exist",
        messages: TIMELINE_FIXTURES,
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(TimelineErrorCode.NotFound);
    }
  });

  it("getClientThread returns null for unknown thread (pure helper)", () => {
    const thread = getClientThread({
      clientId: "client-acme",
      threadId: "nope",
      messages: TIMELINE_FIXTURES,
    });
    expect(thread).toBeNull();
  });
});
