import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  incrementCounter,
  recordHistogram,
  snapshot,
  reset,
  getCounter,
  setMetricsAdapter,
  DEFAULT_LATENCY_BUCKETS,
  InMemoryMetricsAdapter,
  ProductionMetricsAdapter,
  SafeMetricsAdapter,
  computeAvailabilitySLI,
  computeLatencySLI,
  computeAuthAvailabilitySLI,
  computePostageTransitionSLI,
  computeSLOSummary,
  type Metrics,
} from "../../../src/server/api/metrics";

describe("metrics abstraction", () => {
  beforeEach(() => {
    setMetricsAdapter(new InMemoryMetricsAdapter());
    reset();
  });

  describe("InMemoryMetricsAdapter", () => {
    it("increments a named counter and returns correct snapshot", () => {
      incrementCounter("api_requests_total", { method: "GET", path: "/api/test", status: "200" });
      const snap = snapshot();
      expect(snap.counters['api_requests_total{method:"GET",path:"/api/test",status:"200"}']).toBe(
        1,
      );
    });

    it("increments multiple times and supports custom increment values", () => {
      incrementCounter("api_requests_total", 2, {
        method: "POST",
        path: "/api/data",
        status: "201",
      });
      incrementCounter("api_requests_total", { method: "POST", path: "/api/data", status: "201" });
      const snap = snapshot();
      expect(snap.counters['api_requests_total{method:"POST",path:"/api/data",status:"201"}']).toBe(
        3,
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
      incrementCounter("some_metric");
      expect(getCounter("some_metric")).toBe(2);
    });

    it("getCounter returns exact label match count", () => {
      incrementCounter("api_requests", { status: "200" });
      incrementCounter("api_requests", { status: "200" });
      incrementCounter("api_requests", { status: "500" });

      expect(getCounter("api_requests", { status: "200" })).toBe(2);
      expect(getCounter("api_requests", { status: "500" })).toBe(1);
    });

    it("getCounter aggregates total for metric name when no labels specified", () => {
      incrementCounter("api_requests", { status: "200" });
      incrementCounter("api_requests", { status: "500" });
      expect(getCounter("api_requests")).toBe(2);
    });

    it("getCounter returns zero for unknown counters", () => {
      expect(getCounter("non_existent_counter")).toBe(0);
      expect(getCounter("non_existent_counter", { label: "value" })).toBe(0);
    });

    it("reset clears all counters and histograms", () => {
      incrementCounter("test");
      recordHistogram("latency", 50);
      reset();
      const snap = snapshot();
      expect(snap.counters).toEqual({});
      expect(snap.histograms).toEqual({});
      expect(getCounter("test")).toBe(0);
    });
  });

  describe("ProductionMetricsAdapter", () => {
    it("increments counters observably and supports callbacks", () => {
      const recorded: Array<{ name: string; value: number; labels?: Record<string, string> }> = [];
      const adapter = new ProductionMetricsAdapter({
        onRecord: (name, value, labels) => recorded.push({ name, value, labels }),
      });

      adapter.incrementCounter("api_requests_total", 1, { status: "200" });
      expect(adapter.getCounter("api_requests_total", { status: "200" })).toBe(1);
      expect(recorded).toEqual([
        { name: "api_requests_total", value: 1, labels: { status: "200" } },
      ]);
    });

    it("formats stored metrics into Prometheus exposition format", () => {
      const adapter = new ProductionMetricsAdapter();
      adapter.incrementCounter("api_requests_total", 5, { method: "GET", status: "200" });
      const prometheusText = adapter.toPrometheusFormat();
      expect(prometheusText).toContain('api_requests_total{method="GET",status="200"} 5');
    });
  });

  describe("Fault Tolerance (SafeMetricsAdapter)", () => {
    it("metrics collection never throws into request handlers when adapter fails", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const faultyAdapter: Metrics = {
        incrementCounter: () => {
          throw new Error("Backend connection failed");
        },
        recordHistogram: () => {
          throw new Error("Histogram backend unreachable");
        },
        getCounter: () => {
          throw new Error("Database timeout");
        },
      };

      setMetricsAdapter(faultyAdapter);

      expect(() => incrementCounter("api_requests_total")).not.toThrow();
      expect(() => recordHistogram("api_latency", 100)).not.toThrow();
      expect(getCounter("api_requests_total")).toBe(0);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Instrumentation verification", () => {
    it("supports domain_transition_total state transitions", () => {
      incrementCounter("domain_transition_total", {
        entity: "postage",
        from: "pending",
        to: "settled",
      });
      expect(
        getCounter("domain_transition_total", {
          entity: "postage",
          from: "pending",
          to: "settled",
        }),
      ).toBe(1);
    });

    it("supports auth_failures_total and rate_limit_hits_total", () => {
      incrementCounter("auth_failures_total", { reason: "unauthorized" });
      incrementCounter("rate_limit_hits_total", { type: "ip", operation: "read" });

      expect(getCounter("auth_failures_total", { reason: "unauthorized" })).toBe(1);
      expect(getCounter("rate_limit_hits_total", { type: "ip", operation: "read" })).toBe(1);
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

    it("uses default latency buckets when none provided", () => {
      expect(DEFAULT_LATENCY_BUCKETS).toEqual([5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]);
    });
  });

  describe("SLI Computation", () => {
    it("computes API Availability SLI with exact numerator and denominator", () => {
      for (let i = 0; i < 990; i++) {
        incrementCounter("api_requests_total", {
          method: "GET",
          path: "/api/v1/policies",
          status: "200",
        });
      }
      for (let i = 0; i < 10; i++) {
        incrementCounter("api_requests_total", {
          method: "GET",
          path: "/api/v1/policies",
          status: "500",
        });
      }

      const sli = computeAvailabilitySLI();
      expect(sli.numerator).toBe(990);
      expect(sli.denominator).toBe(1000);
      expect(sli.ratio).toBeCloseTo(0.99);
      expect(sli.target).toBe(0.999);
      expect(sli.met).toBe(false);
    });

    it("computes complete SLO summary", () => {
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/policies",
        status: "200",
      });
      recordHistogram("api_latency", 50, {
        method: "GET",
        path: "/api/v1/policies",
        status: "200",
      });

      const summary = computeSLOSummary();
      expect(summary.availability).toBeDefined();
      expect(summary.latency).toBeDefined();
      expect(summary.authAvailability).toBeDefined();
      expect(summary.postageTransitions).toBeDefined();
      expect(summary.availability.met).toBe(true);
    });
  });
});
