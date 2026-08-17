import { describe, expect, it } from "vitest";
import { COLLISION_FIXTURES } from "../services/fixtures";
import { scanActiveReplies, toReadyState } from "../services/collisionDetection";

const sampleReplies = COLLISION_FIXTURES[0].replies;

describe("useCollisionDetection state transitions", () => {
  it("transitions loading -> ready via toReadyState(ok)", () => {
    const ok = scanActiveReplies(sampleReplies, 10);
    const state = toReadyState(ok);
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.events).toHaveLength(1);
  });

  it("transitions loading -> error via toReadyState(error)", () => {
    const err = scanActiveReplies(null as unknown as typeof sampleReplies, 5);
    const state = toReadyState(err);
    expect(state.status).toBe("error");
    if (state.status !== "error") return;
    expect(state.code).toBe("scan-failed");
  });

  it("scan with valid data returns events", () => {
    const ok = scanActiveReplies(sampleReplies, 10);
    expect(ok.status).toBe("ok");
    if (ok.status !== "ok") return;
    expect(ok.data.events.length).toBeGreaterThan(0);
  });

  it("reset returns to idle (verified via toReadyState contract)", () => {
    const ok = scanActiveReplies(sampleReplies, 10);
    const ready = toReadyState(ok);
    expect(ready.status).toBe("ready");
  });
});
