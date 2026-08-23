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
  computeRelayDeliverySLI,
  computeChainQueueSLI,
  computeStorageAvailabilitySLI,
  computeProvisioningSLI,
  computeSyncAvailabilitySLI,
  computeSLOSummary,
} from "../../../src/server/api/metrics";

describe("metrics & service-level indicators (BETA-092)", () => {
  beforeEach(() => {
    reset();
  });

  describe("incrementCounter", () => {
    it("increments a named counter", () => {
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/test",
        status: "200",
      });
      const snap = snapshot();
      expect(snap.counters['api_requests_total{method:"GET",path:"/api/test",status:"200"}']).toBe(
        1,
      );
    });

    it("increments multiple times", () => {
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/data",
        status: "201",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/data",
        status: "201",
      });
      const snap = snapshot();
      expect(snap.counters['api_requests_total{method:"POST",path:"/api/data",status:"201"}']).toBe(
        2,
      );
    });

    it("separates counters by labels", () => {
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/a",
        status: "200",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/b",
        status: "400",
      });
      const snap = snapshot();
      expect(Object.keys(snap.counters)).toHaveLength(2);
    });

    it("works without labels", () => {
      incrementCounter("api_requests_total");
      const snap = snapshot();
      expect(snap.counters["api_requests_total"]).toBe(1);
    });
  });

  describe("recordHistogram", () => {
    it("records a value into the correct bucket", () => {
      recordHistogram("api_latency", 30, {
        method: "GET",
        path: "/api/test",
        status: "200",
      });
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
      recordHistogram("api_latency", 10, {
        method: "GET",
        path: "/api/a",
        status: "200",
      });
      recordHistogram("api_latency", 200, {
        method: "POST",
        path: "/api/b",
        status: "500",
      });

      const snap = snapshot();
      expect(Object.keys(snap.histograms)).toHaveLength(2);
    });
  });

  describe("RED / USE stage metrics", () => {
    it("records Auth RED/USE metrics", () => {
      incrementCounter("auth_requests_total", {
        operation: "challenge",
        status: "200",
        outcome: "success",
      });
      recordHistogram("auth_latency", 45, {
        operation: "challenge",
        status: "200",
      });
      incrementCounter("auth_errors_total", {
        operation: "verify",
        error_type: "ERR_UNAUTHORIZED",
      });
      incrementCounter("auth_active_sessions", { method: "sep10" });

      const snap = snapshot();
      expect(
        snap.counters['auth_requests_total{operation:"challenge",outcome:"success",status:"200"}'],
      ).toBe(1);
      expect(snap.histograms['auth_latency{operation:"challenge",status:"200"}'].count).toBe(1);
      expect(
        snap.counters['auth_errors_total{error_type:"ERR_UNAUTHORIZED",operation:"verify"}'],
      ).toBe(1);
      expect(snap.counters['auth_active_sessions{method:"sep10"}']).toBe(1);
    });

    it("records Provisioning RED metrics", () => {
      incrementCounter("provisioning_operations_total", {
        step: "reserve_username",
        status: "201",
        outcome: "success",
      });
      recordHistogram("provisioning_latency", 120, {
        step: "reserve_username",
        status: "201",
      });

      const snap = snapshot();
      expect(
        snap.counters[
          'provisioning_operations_total{outcome:"success",status:"201",step:"reserve_username"}'
        ],
      ).toBe(1);
    });

    it("records Relay RED/USE metrics", () => {
      incrementCounter("relay_requests_total", {
        stage: "relay",
        status: "200",
        delivery_state: "ACKNOWLEDGED",
      });
      incrementCounter("relay_retry_count", {
        stage: "relay",
        reason: "timeout",
      });

      const snap = snapshot();
      expect(
        snap.counters[
          'relay_requests_total{delivery_state:"ACKNOWLEDGED",stage:"relay",status:"200"}'
        ],
      ).toBe(1);
      expect(snap.counters['relay_retry_count{reason:"timeout",stage:"relay"}']).toBe(1);
    });

    it("records Storage RED/USE metrics", () => {
      incrementCounter("storage_operations_total", {
        backend: "r2",
        operation: "put_envelope",
        status: "200",
      });
      incrementCounter("storage_utilization_ratio", { backend: "r2" });

      const snap = snapshot();
      expect(
        snap.counters[
          'storage_operations_total{backend:"r2",operation:"put_envelope",status:"200"}'
        ],
      ).toBe(1);
    });

    it("records Sync RED/USE metrics", () => {
      incrementCounter("sync_operations_total", {
        operation: "checkpoint_update",
        status: "200",
      });
      incrementCounter("sync_gaps_detected_total", { stream_type: "receipts" });

      const snap = snapshot();
      expect(
        snap.counters['sync_operations_total{operation:"checkpoint_update",status:"200"}'],
      ).toBe(1);
      expect(snap.counters['sync_gaps_detected_total{stream_type:"receipts"}']).toBe(1);
    });

    it("records Chain Queue RED/USE metrics", () => {
      incrementCounter("chain_queue_depth", {
        queue_name: "settlement_jobs",
        status: "active",
      });
      incrementCounter("chain_queue_operations_total", {
        operation: "settle_escrow",
        status: "200",
        outcome: "success",
      });
      incrementCounter("chain_dead_letters_total", {
        job_type: "settlement",
        error_code: "ERR_CONTRACT_REVERT",
      });

      const snap = snapshot();
      expect(
        snap.counters[
          'chain_queue_operations_total{operation:"settle_escrow",outcome:"success",status:"200"}'
        ],
      ).toBe(1);
      expect(
        snap.counters[
          'chain_dead_letters_total{error_code:"ERR_CONTRACT_REVERT",job_type:"settlement"}'
        ],
      ).toBe(1);
    });

    it("records Delivery stage transitions", () => {
      incrementCounter("delivery_stage_transitions_total", {
        from_stage: "escrowed",
        to_stage: "submitted",
        status: "success",
      });

      const snap = snapshot();
      expect(
        snap.counters[
          'delivery_stage_transitions_total{from_stage:"escrowed",status:"success",to_stage:"submitted"}'
        ],
      ).toBe(1);
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
      recordHistogram("api_latency", 20, labels);
      recordHistogram("api_latency", 100, labels);
      recordHistogram("api_latency", 400, labels);

      const sli = computeLatencySLI(250);
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.ratio).toBeCloseTo(2 / 3);
    });

    it("computes Authentication Availability SLI for auth paths & auth metrics", () => {
      incrementCounter("auth_requests_total", {
        operation: "verify",
        status: "200",
        outcome: "success",
      });
      incrementCounter("auth_requests_total", {
        operation: "verify",
        status: "401",
        outcome: "security_denied",
      });
      incrementCounter("auth_requests_total", {
        operation: "verify",
        status: "500",
        outcome: "unexpected_error",
      });

      const sli = computeAuthAvailabilitySLI();
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
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/quote",
        status: "422",
      });
      incrementCounter("api_requests_total", {
        method: "POST",
        path: "/api/v1/postage/settle",
        status: "500",
      });

      const sli = computePostageTransitionSLI();
      expect(sli.numerator).toBe(4);
      expect(sli.denominator).toBe(5);
      expect(sli.ratio).toBeCloseTo(0.8);
      expect(sli.target).toBe(0.999);
    });

    it("computes Relay Delivery SLI", () => {
      incrementCounter("relay_requests_total", {
        stage: "relay",
        status: "200",
        delivery_state: "ACKNOWLEDGED",
      });
      incrementCounter("relay_requests_total", {
        stage: "relay",
        status: "200",
        delivery_state: "DEDUPLICATED",
      });
      incrementCounter("relay_requests_total", {
        stage: "relay",
        status: "503",
        delivery_state: "FAILED",
      });

      const sli = computeRelayDeliverySLI();
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.ratio).toBeCloseTo(2 / 3);
      expect(sli.target).toBe(0.995);
      expect(sli.met).toBe(false);
    });

    it("computes Chain Queue SLI including dead letters", () => {
      incrementCounter("chain_queue_operations_total", {
        operation: "settle",
        status: "200",
        outcome: "success",
      });
      incrementCounter("chain_queue_operations_total", {
        operation: "settle",
        status: "200",
        outcome: "success",
      });
      incrementCounter("chain_dead_letters_total", {
        job_type: "settlement",
        error_code: "ERR_CONTRACT_REVERT",
      });

      const sli = computeChainQueueSLI();
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.ratio).toBeCloseTo(2 / 3);
      expect(sli.target).toBe(0.999);
    });

    it("computes Storage Availability SLI", () => {
      incrementCounter("storage_operations_total", {
        backend: "r2",
        operation: "put",
        status: "200",
      });
      incrementCounter("storage_operations_total", {
        backend: "kv",
        operation: "get",
        status: "200",
      });
      incrementCounter("storage_operations_total", {
        backend: "r2",
        operation: "get",
        status: "500",
      });

      const sli = computeStorageAvailabilitySLI();
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.target).toBe(0.9999);
    });

    it("computes Provisioning SLI", () => {
      incrementCounter("provisioning_operations_total", {
        step: "reserve",
        status: "200",
        outcome: "success",
      });
      incrementCounter("provisioning_operations_total", {
        step: "link",
        status: "200",
        outcome: "success",
      });
      incrementCounter("provisioning_operations_total", {
        step: "link",
        status: "500",
        outcome: "unexpected_error",
      });

      const sli = computeProvisioningSLI();
      expect(sli.numerator).toBe(2);
      expect(sli.denominator).toBe(3);
      expect(sli.target).toBe(0.99);
    });

    it("computes Sync Availability SLI", () => {
      incrementCounter("sync_operations_total", {
        operation: "pull",
        status: "200",
      });
      incrementCounter("sync_operations_total", {
        operation: "pull",
        status: "500",
      });

      const sli = computeSyncAvailabilitySLI();
      expect(sli.numerator).toBe(1);
      expect(sli.denominator).toBe(2);
      expect(sli.target).toBe(0.999);
    });

    it("computes comprehensive SLO summary across all 9 indicators", () => {
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
      expect(summary.relayDelivery).toBeDefined();
      expect(summary.chainQueue).toBeDefined();
      expect(summary.storageAvailability).toBeDefined();
      expect(summary.provisioning).toBeDefined();
      expect(summary.syncAvailability).toBeDefined();
      expect(summary.allMet).toBe(true);
    });
  });

  describe("cardinality limits & anti-enumeration protection", () => {
    it("fails fast on unknown labels outside production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        expect(() => {
          incrementCounter("api_requests_total", {
            method: "GET",
            unknown_label: "bad",
          });
        }).toThrow("Unknown label 'unknown_label' for metric 'api_requests_total'");

        expect(() => {
          incrementCounter("unknown_metric" as any, { method: "GET" });
        }).toThrow("Unknown metric name: unknown_metric");
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("drops unknown labels in production to prevent unbounded cardinality", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        incrementCounter("api_requests_total", {
          method: "GET",
          user_id: "user1",
        });
        incrementCounter("api_requests_total", {
          method: "GET",
          user_id: "user2",
        });
        const snap = snapshot();
        expect(Object.keys(snap.counters)).toHaveLength(1);
        expect(snap.counters['api_requests_total{method:"GET"}']).toBe(2);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("prevents correspondent enumeration by refusing user and recipient address labels", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        // Attempting to track user communicating with recipient
        incrementCounter("relay_requests_total", {
          stage: "relay",
          sender_address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          recipient_address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          status: "200",
        });
        incrementCounter("relay_requests_total", {
          stage: "relay",
          sender_address: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          recipient_address: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
          status: "200",
        });

        const snap = snapshot();
        // Since sender/recipient addresses are stripped, both fold into the same bounded series
        expect(Object.keys(snap.counters)).toHaveLength(1);
        expect(snap.counters['relay_requests_total{stage:"relay",status:"200"}']).toBe(2);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
