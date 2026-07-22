import { describe, expect, it, beforeEach } from "vitest";
import {
  incrementCounter,
  recordHistogram,
  snapshot,
  reset,
  DEFAULT_LATENCY_BUCKETS,
  computeAvailabilitySLI,
  computeLatencySLI,
  computeAuthAvailabilitySLI,
  computePostageTransitionSLI,
  computeSLOSummary,
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

  describe("SLI Computation", () => {
    it("computes API Availability SLI with exact numerator and denominator", () => {
      // 990 successful requests (200, 400, 404, etc.), 10 server error requests (500)
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

    it("excludes configured paths like health check from Availability SLI", () => {
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/health",
        status: "200",
      });
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/policies",
        status: "200",
      });
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/policies",
        status: "500",
      });

      const sli = computeAvailabilitySLI();
      expect(sli.numerator).toBe(1);
      expect(sli.denominator).toBe(2);
      expect(sli.ratio).toBe(0.5);
    });

    it("computes API Latency SLI within threshold", () => {
      const labels = { method: "GET", path: "/api/v1/policies", status: "200" };
      recordHistogram("api_latency", 20, labels); // <= 250ms
      recordHistogram("api_latency", 100, labels); // <= 250ms
      recordHistogram("api_latency", 400, labels); // > 250ms

      const sli = computeLatencySLI(250);
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.ratio).toBeCloseTo(2 / 3);
    });

    it("computes Authentication Availability SLI for auth paths", () => {
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/auth/login",
        status: "200",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/auth/login",
        status: "401",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/auth/login",
        status: "500",
      });
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/policies",
        status: "500",
      });

      const sli = computeAuthAvailabilitySLI();
      // Auth requests: 200 (non-5xx), 401 (non-5xx), 500 (5xx)
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.target).toBe(0.9995);
    });

    it("computes Critical Postage Transitions SLI", () => {
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/quote",
        status: "200",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/settle",
        status: "201",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/settle",
        status: "409",
      }); // idempotency handled
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/quote",
        status: "422",
      }); // validation handled
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/settle",
        status: "500",
      }); // system error

      const sli = computePostageTransitionSLI();
      expect(sli.numerator).toBe(4);
      expect(sli.denominator).toBe(5);
      expect(sli.ratio).toBeCloseTo(0.8);
      expect(sli.target).toBe(0.999);
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
