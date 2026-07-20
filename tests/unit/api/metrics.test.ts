import { beforeEach, describe, expect, it } from "vitest";

import {
  _resetMetrics,
  getAvailability,
  getMeanLatencyMs,
  getMetrics,
  incrementCounter,
  recordDependencyCall,
  recordLatency,
} from "../../../src/server/api/metrics";

beforeEach(() => {
  _resetMetrics();
});

describe("incrementCounter", () => {
  it("counts a success for kv", () => {
    incrementCounter("dependency_call_success", { dependency: "kv" });
    const m = getMetrics("kv");
    expect(m.calls).toBe(1);
    expect(m.successes).toBe(1);
    expect(m.timeouts).toBe(0);
    expect(m.failures).toBe(0);
  });

  it("counts a timeout for coordinator", () => {
    incrementCounter("dependency_call_timeout", { dependency: "coordinator" });
    const m = getMetrics("coordinator");
    expect(m.calls).toBe(1);
    expect(m.timeouts).toBe(1);
    expect(m.successes).toBe(0);
  });

  it("counts a failure for kv", () => {
    incrementCounter("dependency_call_failure", { dependency: "kv" });
    const m = getMetrics("kv");
    expect(m.calls).toBe(1);
    expect(m.failures).toBe(1);
  });

  it("ignores unknown dependency labels", () => {
    incrementCounter("dependency_call_success", { dependency: "unknown" });
    expect(getMetrics("kv").calls).toBe(0);
    expect(getMetrics("coordinator").calls).toBe(0);
  });

  it("ignores missing dependency label", () => {
    incrementCounter("dependency_call_success", {});
    expect(getMetrics("kv").calls).toBe(0);
  });

  it("does not increment counters for unrecognised metric names", () => {
    incrementCounter("postage_limit_rejected", { dependency: "kv" });
    // calls increments but success/timeout/failure stay zero
    const m = getMetrics("kv");
    expect(m.calls).toBe(1);
    expect(m.successes).toBe(0);
    expect(m.failures).toBe(0);
  });
});

describe("recordLatency", () => {
  it("accumulates latency samples for kv", () => {
    recordLatency("kv", 10);
    recordLatency("kv", 30);
    const m = getMetrics("kv");
    expect(m.latencySamples).toBe(2);
    expect(m.totalLatencyMs).toBe(40);
  });

  it("accumulates latency samples for coordinator", () => {
    recordLatency("coordinator", 5);
    expect(getMetrics("coordinator").totalLatencyMs).toBe(5);
  });
});

describe("recordDependencyCall", () => {
  it("emits success and latency on a resolved call", async () => {
    await recordDependencyCall("kv", async () => "ok");
    const m = getMetrics("kv");
    expect(m.calls).toBe(1);
    expect(m.successes).toBe(1);
    expect(m.latencySamples).toBe(1);
    expect(m.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("emits failure and latency on a generic error", async () => {
    await expect(
      recordDependencyCall("kv", async () => {
        throw new Error("connection refused");
      }),
    ).rejects.toThrow("connection refused");

    const m = getMetrics("kv");
    expect(m.calls).toBe(1);
    expect(m.failures).toBe(1);
    expect(m.successes).toBe(0);
    expect(m.latencySamples).toBe(1);
  });

  it("classifies AbortError as timeout", async () => {
    const abortErr = new DOMException("signal aborted", "AbortError");
    await expect(
      recordDependencyCall("coordinator", async () => {
        throw abortErr;
      }),
    ).rejects.toThrow();

    const m = getMetrics("coordinator");
    expect(m.timeouts).toBe(1);
    expect(m.failures).toBe(0);
  });

  it("classifies errors with 'timeout' in message as timeout", async () => {
    await expect(
      recordDependencyCall("coordinator", async () => {
        throw new Error("Request timeout after 5000ms");
      }),
    ).rejects.toThrow();

    expect(getMetrics("coordinator").timeouts).toBe(1);
  });

  it("re-throws the original error after recording", async () => {
    const err = new Error("boom");
    await expect(recordDependencyCall("kv", async () => Promise.reject(err))).rejects.toBe(err);
  });

  it("tracks kv and coordinator independently", async () => {
    await recordDependencyCall("kv", async () => "a");
    await recordDependencyCall("kv", async () => "b");
    await recordDependencyCall("coordinator", async () => "c");

    expect(getMetrics("kv").calls).toBe(2);
    expect(getMetrics("coordinator").calls).toBe(1);
  });
});

describe("getAvailability", () => {
  it("returns 1 when no calls recorded", () => {
    expect(getAvailability("kv")).toBe(1);
  });

  it("returns 1 when all calls succeeded", async () => {
    await recordDependencyCall("kv", async () => "ok");
    await recordDependencyCall("kv", async () => "ok");
    expect(getAvailability("kv")).toBe(1);
  });

  it("returns 0.5 when half the calls failed", async () => {
    await recordDependencyCall("kv", async () => "ok");
    await expect(
      recordDependencyCall("kv", async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow();
    expect(getAvailability("kv")).toBe(0.5);
  });
});

describe("getMeanLatencyMs", () => {
  it("returns 0 when no samples", () => {
    expect(getMeanLatencyMs("coordinator")).toBe(0);
  });

  it("returns the mean of recorded samples", () => {
    recordLatency("coordinator", 20);
    recordLatency("coordinator", 40);
    expect(getMeanLatencyMs("coordinator")).toBe(30);
  });
});

describe("_resetMetrics", () => {
  it("resets all counters to zero", async () => {
    await recordDependencyCall("kv", async () => "x");
    _resetMetrics();
    const m = getMetrics("kv");
    expect(m.calls).toBe(0);
    expect(m.latencySamples).toBe(0);
  });
});
