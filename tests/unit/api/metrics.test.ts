import { describe, expect, it, beforeEach } from "vitest";
import {
  incrementCounter,
  recordHistogram,
  snapshot,
  reset,
  DEFAULT_LATENCY_BUCKETS,
} from "../../../src/server/api/metrics";

describe("metrics", () => {
  beforeEach(() => {
    reset();
  });

  describe("incrementCounter", () => {
    it("increments a named counter", () => {
      incrementCounter("api_requests_total", { method: "GET", path: "/api/test", status: "200" });
      const snap = snapshot();
      expect(snap.counters['api_requests_total{method:"GET",path:"/api/test",status:"200"}']).toBe(
        1,
      );
    });

    it("increments multiple times", () => {
      incrementCounter("api_requests_total", { method: "POST", path: "/api/data", status: "201" });
      incrementCounter("api_requests_total", { method: "POST", path: "/api/data", status: "201" });
      const snap = snapshot();
      expect(snap.counters['api_requests_total{method:"POST",path:"/api/data",status:"201"}']).toBe(
        2,
      );
    });

    it("separates counters by labels", () => {
      incrementCounter("api_requests_total", { method: "GET", path: "/api/a", status: "200" });
      incrementCounter("api_requests_total", { method: "POST", path: "/api/b", status: "400" });
      const snap = snapshot();
      expect(Object.keys(snap.counters)).toHaveLength(2);
    });

    it("works without labels", () => {
      incrementCounter("some_metric");
      const snap = snapshot();
      expect(snap.counters["some_metric"]).toBe(1);
    });
  });

  describe("recordHistogram", () => {
    it("records a value into the correct bucket", () => {
      recordHistogram("api_latency", 30, { method: "GET", path: "/api/test", status: "200" });
      const snap = snapshot();
      const hist = snap.histograms['api_latency{method:"GET",path:"/api/test",status:"200"}'];
      expect(hist).toBeDefined();
      expect(hist.count).toBe(1);
      expect(hist.sum).toBeCloseTo(30);
      // 30ms falls in the ~50 bucket
      expect(hist.buckets["~50"]).toBe(1);
    });

    it("places values in the correct buckets", () => {
      const labels = { method: "GET", path: "/api/test", status: "200" };
      recordHistogram("api_latency", 3, labels); // ~5
      recordHistogram("api_latency", 12, labels); // ~25
      recordHistogram("api_latency", 80, labels); // ~100
      recordHistogram("api_latency", 3000, labels); // ~5000
      recordHistogram("api_latency", 6000, labels); // ~+Inf

      const snap = snapshot();
      const hist = snap.histograms['api_latency{method:"GET",path:"/api/test",status:"200"}'];
      expect(hist.count).toBe(5);
      expect(hist.buckets["~5"]).toBe(1);
      expect(hist.buckets["~25"]).toBe(1);
      expect(hist.buckets["~100"]).toBe(1);
      expect(hist.buckets["~5000"]).toBe(1);
      expect(hist.buckets["~+Inf"]).toBe(1);
    });

    it("tracks total sum of recorded values", () => {
      const labels = { method: "GET", path: "/api/test", status: "200" };
      recordHistogram("api_latency", 10, labels);
      recordHistogram("api_latency", 20, labels);
      recordHistogram("api_latency", 30, labels);

      const snap = snapshot();
      const hist = snap.histograms['api_latency{method:"GET",path:"/api/test",status:"200"}'];
      expect(hist.sum).toBeCloseTo(60);
    });

    it("uses default latency buckets when none provided", () => {
      expect(DEFAULT_LATENCY_BUCKETS).toEqual([5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]);
    });

    it("separates histograms by labels", () => {
      recordHistogram("api_latency", 10, { method: "GET", path: "/api/a", status: "200" });
      recordHistogram("api_latency", 200, { method: "POST", path: "/api/b", status: "500" });

      const snap = snapshot();
      expect(Object.keys(snap.histograms)).toHaveLength(2);
    });
  });

  describe("snapshot / reset", () => {
    it("snapshot returns current state without mutation", () => {
      incrementCounter("test", { label: "a" });
      const snap1 = snapshot();
      expect(snap1.counters['test{label:"a"}']).toBe(1);

      // Mutating the snapshot should not affect internal state
      snap1.counters['test{label:"a"}'] = 999;
      const snap2 = snapshot();
      expect(snap2.counters['test{label:"a"}']).toBe(1);
    });

    it("reset clears all counters and histograms", () => {
      incrementCounter("test");
      recordHistogram("latency", 50);
      reset();
      const snap = snapshot();
      expect(snap.counters).toEqual({});
      expect(snap.histograms).toEqual({});
    });
  });
});
