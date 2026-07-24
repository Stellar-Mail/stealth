import { describe, expect, it } from "vitest";

import {
  detectCollisions,
  scanActiveReplies,
  toReadyState,
  type ActiveReply,
} from "../services/collisionDetection";
import { COLLISION_FIXTURES, EMPTY_REPLIES, SINGLE_REPLY } from "../services/fixtures";

describe("detectCollisions", () => {
  it("detects a collision when two teammates reply to the same thread", () => {
    const fixture = COLLISION_FIXTURES[0];
    const events = detectCollisions(fixture.replies);
    expect(events).toHaveLength(fixture.expectedEventCount);
    expect(events[0].severity).toBe("warning");
  });

  it("marks three or more replies as critical severity", () => {
    const fixture = COLLISION_FIXTURES[1];
    const events = detectCollisions(fixture.replies);
    expect(events).toHaveLength(fixture.expectedEventCount);
    expect(events[0].severity).toBe("critical");
  });

  it("returns no events when all replies target different threads", () => {
    const fixture = COLLISION_FIXTURES[2];
    const events = detectCollisions(fixture.replies);
    expect(events).toHaveLength(fixture.expectedEventCount);
  });

  it("returns no events from a single reply", () => {
    const events = detectCollisions(SINGLE_REPLY);
    expect(events).toHaveLength(0);
  });

  it("returns no events from an empty reply list", () => {
    const events = detectCollisions(EMPTY_REPLIES);
    expect(events).toHaveLength(0);
  });
});

describe("scanActiveReplies", () => {
  it("returns ok with valid data", () => {
    const result = scanActiveReplies(COLLISION_FIXTURES[0].replies, 10);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.events).toHaveLength(1);
    expect(result.data.monitoredThreads).toBe(10);
  });

  it("returns error for invalid replies input", () => {
    const result = scanActiveReplies(null as unknown as ActiveReply[], 5);
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("scan-failed");
  });

  it("returns error for negative thread count", () => {
    const result = scanActiveReplies(EMPTY_REPLIES, -1);
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.code).toBe("scan-failed");
  });

  it("produces deterministic output", () => {
    const a = scanActiveReplies(COLLISION_FIXTURES[0].replies, 10);
    const b = scanActiveReplies(COLLISION_FIXTURES[0].replies, 10);
    expect(a).toEqual(b);
  });
});

describe("toReadyState", () => {
  it("maps an ok result to ready state", () => {
    const result = scanActiveReplies(COLLISION_FIXTURES[0].replies, 10);
    const state = toReadyState(result);
    expect(state.status).toBe("ready");
  });

  it("maps an error result to error state", () => {
    const result = scanActiveReplies(null as unknown as ActiveReply[], 5);
    const state = toReadyState(result);
    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.code).toBe("scan-failed");
  });

  it("processes every fixture without errors", () => {
    for (const fixture of COLLISION_FIXTURES) {
      const result = scanActiveReplies(fixture.replies, 5);
      expect(result.status).toBe("ok");
    }
  });
});
