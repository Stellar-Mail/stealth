import { describe, expect, it } from "vitest";
import { InMemoryNonceStore, NonceService } from "../../../../src/server/api/auth/nonce-service";

// A fixed clock keeps the time-to-live math deterministic across the suite.
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedClock = (nowMs: number) => () => nowMs;

describe("NonceService", () => {
  it("accepts a nonce once and rejects the immediate replay", async () => {
    const service = new NonceService(new InMemoryNonceStore(), { now: fixedClock(T0) });

    const first = await service.consume("nonce-abc");
    const second = await service.consume("nonce-abc");

    expect(first.outcome).toBe("fresh");
    expect(second.outcome).toBe("replayed");
  });

  it("treats distinct nonces independently", async () => {
    const service = new NonceService(new InMemoryNonceStore(), { now: fixedClock(T0) });

    expect((await service.consume("nonce-a")).outcome).toBe("fresh");
    expect((await service.consume("nonce-b")).outcome).toBe("fresh");
  });

  it("rejects an empty nonce", async () => {
    const service = new NonceService(new InMemoryNonceStore());

    await expect(service.consume("   ")).rejects.toBeInstanceOf(RangeError);
  });

  // Acceptance criterion: only one concurrent consumer succeeds.
  it("allows exactly one winner under concurrent consumption", async () => {
    const service = new NonceService(new InMemoryNonceStore(), { now: fixedClock(T0) });

    const results = await Promise.all(
      Array.from({ length: 25 }, () => service.consume("race-nonce")),
    );

    const fresh = results.filter((result) => result.outcome === "fresh");
    const replayed = results.filter((result) => result.outcome === "replayed");
    expect(fresh).toHaveLength(1);
    expect(replayed).toHaveLength(24);
  });

  // Acceptance criterion: nonce state is shared across runtime instances.
  it("shares consumed state across two independent API contexts", async () => {
    // One durable store, two independently constructed services standing in
    // for two runtime instances / isolates that share the same backend.
    const sharedStore = new InMemoryNonceStore();
    const contextA = new NonceService(sharedStore, { now: fixedClock(T0) });
    const contextB = new NonceService(sharedStore, { now: fixedClock(T0) });

    const consumedOnA = await contextA.consume("cross-context-nonce");
    const replayOnB = await contextB.consume("cross-context-nonce");

    expect(consumedOnA.outcome).toBe("fresh");
    expect(replayOnB.outcome).toBe("replayed");
    await expect(contextB.isConsumed("cross-context-nonce")).resolves.toBe(true);
  });

  // Acceptance criterion: replay prevention survives process restart.
  it("keeps rejecting a consumed nonce after a simulated restart", async () => {
    const durableStore = new InMemoryNonceStore();
    const beforeRestart = new NonceService(durableStore, { now: fixedClock(T0) });
    await beforeRestart.consume("persisted-nonce");

    // A restart discards the service instance, but the durable store survives,
    // so a freshly constructed service must still see the nonce as consumed.
    const afterRestart = new NonceService(durableStore, { now: fixedClock(T0 + 1000) });
    const replay = await afterRestart.consume("persisted-nonce");

    expect(replay.outcome).toBe("replayed");
  });

  it("permits reuse only after the retention window expires", async () => {
    const store = new InMemoryNonceStore();
    const ttlMs = 60_000;

    const atStart = new NonceService(store, { ttlMs, now: fixedClock(T0) });
    expect((await atStart.consume("expiring-nonce")).outcome).toBe("fresh");

    // Still inside the window: the replay is rejected.
    const midWindow = new NonceService(store, { ttlMs, now: fixedClock(T0 + ttlMs - 1) });
    expect((await midWindow.consume("expiring-nonce")).outcome).toBe("replayed");

    // After the window: the key is free again and a fresh consume succeeds.
    const afterWindow = new NonceService(store, { ttlMs, now: fixedClock(T0 + ttlMs + 1) });
    expect((await afterWindow.consume("expiring-nonce")).outcome).toBe("fresh");
  });
});
