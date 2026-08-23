import { describe, expect, it, beforeEach } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { createApiContext } from "../../../src/server/api/context";
import {
  planPrivacySafeLog,
  deriveSupportId,
  ALLOWED_LOG_FIELDS,
  type PrivacySafeLogRecord,
} from "../../../src/server/api/logging";
import {
  incrementCounter,
  recordHistogram,
  snapshot,
  reset,
  computeSLOSummary,
} from "../../../src/server/api/metrics";
import { enqueueDurableJob, recordJobFailure } from "../../../src/server/api/job-service";
import { apiSuccess, apiFailure, SUPPORT_ID_HEADER } from "../../../src/server/api/response";
import { ApiError } from "../../../src/server/api/errors";

describe("BETA-092 :: End-to-End Observability & Operator Investigation", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
    reset();
  });

  it("allows an operator to trace a multi-stage send failure using supportId without seeing private content", async () => {
    const requestId = "req-test-send-failure-1234";
    const supportId = deriveSupportId(requestId);
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";

    const context = createApiContext(repo, null, requestId, {
      traceId,
      spanId,
      traceFlags: "01",
    });

    const emittedLogs: PrivacySafeLogRecord[] = [];

    function recordLog(event: Parameters<typeof planPrivacySafeLog>[0]) {
      const decision = planPrivacySafeLog(event, { successSampleRate: 1 });
      if (decision.log) {
        emittedLogs.push(decision.log);
      }
    }

    // Stage 1: Delivery Quote (Success)
    recordLog({
      stage: "delivery",
      operation: "quote",
      status: 200,
      outcome: "success",
      requestId: context.requestId!,
      supportId,
      traceId,
      spanId,
      latencyMs: 12.4,
      safeTargetReference: "msg-test-999",
    });
    incrementCounter("delivery_operations_total", {
      stage: "quote",
      status: "200",
      outcome: "success",
    });

    // Stage 2: Postage Escrow Reservation (Success)
    recordLog({
      stage: "delivery",
      operation: "escrow",
      status: 201,
      outcome: "success",
      requestId: context.requestId!,
      supportId,
      traceId,
      spanId,
      latencyMs: 45.2,
      safeTargetReference: "msg-test-999",
    });
    incrementCounter("delivery_operations_total", {
      stage: "escrow",
      status: "201",
      outcome: "success",
    });

    // Stage 3: Relay Submission (Success ACK)
    recordLog({
      stage: "relay",
      operation: "submit",
      status: 200,
      outcome: "success",
      requestId: context.requestId!,
      supportId,
      traceId,
      spanId,
      latencyMs: 110.0,
      safeTargetReference: "msg-test-999",
    });
    incrementCounter("relay_requests_total", {
      stage: "relay",
      status: "200",
      delivery_state: "ACKNOWLEDGED",
    });

    // Stage 4: Chain Queue Execution (Failure & DLQ)
    const enqueueRes = await enqueueDurableJob(repo, {
      type: "postage",
      idempotencyKey: "idem-settle-msg-test-999",
      payload: {
        messageId: "msg-test-999",
        // Prohibited private fields that should never leak in logs:
        senderSecretSeed: "SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        messagePlaintext: "Confidential financial instructions",
        ciphertextBlob: "0xabcdef1234567890",
      },
      maxAttempts: 1,
    });

    const failureRes = await recordJobFailure(
      repo,
      enqueueRes.job,
      new Error("Soroban Horizon RPC timed out after 30000ms: ERR_RPC_TIMEOUT"),
      { forceNonRetryable: true },
    );

    expect(failureRes.deadLetter).toBeDefined();

    recordLog({
      stage: "chain_queue",
      operation: "settle_escrow",
      status: 500,
      outcome: "unexpected_error",
      requestId: context.requestId!,
      supportId,
      traceId,
      spanId,
      queueName: "settlement_jobs",
      errorCode: failureRes.deadLetter?.errorCode ?? "ERR_RPC_TIMEOUT",
      attempt: failureRes.job.attempts,
      latencyMs: 30000,
      safeTargetReference: "msg-test-999",
    });
    incrementCounter("chain_queue_operations_total", {
      operation: "settle_escrow",
      status: "500",
      outcome: "unexpected_error",
    });
    incrementCounter("chain_dead_letters_total", {
      job_type: "settlement",
      error_code: "ERR_RPC_TIMEOUT",
    });

    // Operator Triage Simulation:
    // Operator searches logs matching the user's supportId
    const operatorTracedLogs = emittedLogs.filter((log) => log.supportId === supportId);

    expect(operatorTracedLogs).toHaveLength(4);
    expect(operatorTracedLogs.map((l) => l.stage)).toEqual([
      "delivery",
      "delivery",
      "relay",
      "chain_queue",
    ]);

    // Pinpoint broken stage:
    const brokenStage = operatorTracedLogs.find((l) => l.outcome === "unexpected_error");
    expect(brokenStage).toBeDefined();
    expect(brokenStage?.stage).toBe("chain_queue");
    expect(brokenStage?.operation).toBe("settle_escrow");
    expect(brokenStage?.errorCode).toBe("ERR_RPC_TIMEOUT");

    // Strict Privacy Verification:
    for (const log of operatorTracedLogs) {
      // 1. Check all log fields are in allowlist
      for (const key of Object.keys(log)) {
        expect(ALLOWED_LOG_FIELDS).toContain(key);
      }
      const logString = JSON.stringify(log);

      // 2. Ensure NO plaintext, secret seed, or raw ciphertext appears in any log entry
      expect(logString).not.toContain("Confidential financial instructions");
      expect(logString).not.toContain("SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
      expect(logString).not.toContain("0xabcdef1234567890");
    }
  });

  it("confirms metrics cannot be used to enumerate a user's correspondents", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const users = [
        {
          sender: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          recipient: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        },
        {
          sender: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          recipient: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        },
        {
          sender: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
          recipient: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
        },
      ];

      for (const u of users) {
        incrementCounter("relay_requests_total", {
          stage: "relay",
          status: "200",
          delivery_state: "ACKNOWLEDGED",
          // Attempt injection of correspondent tracking labels:
          sender: u.sender,
          recipient: u.recipient,
        });
      }

      const snap = snapshot();
      const relayKeys = Object.keys(snap.counters).filter((k) =>
        k.startsWith("relay_requests_total"),
      );

      // Exactly 1 bounded series exists despite multiple sender/recipient pairs
      expect(relayKeys).toHaveLength(1);
      expect(relayKeys[0]).toBe(
        'relay_requests_total{delivery_state:"ACKNOWLEDGED",stage:"relay",status:"200"}',
      );
      expect(snap.counters[relayKeys[0]]).toBe(3);

      // Verify no address strings are leaked in any metric label key
      for (const key of Object.keys(snap.counters)) {
        expect(key).not.toContain("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        expect(key).not.toContain("GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
        expect(key).not.toContain("GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC");
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("propagates supportId and correlation ID across API response envelopes and headers", async () => {
    const request = new Request("https://api.stealth.test/api/v1/postage/quote", {
      method: "POST",
      headers: {
        "x-request-id": "client-correlation-abc-999",
      },
    });

    const successResponse = apiSuccess(request, { quoteId: "q-123", amount: "0.01" });
    expect(successResponse.headers.get(SUPPORT_ID_HEADER)).toMatch(/^sup_[a-f0-9]+/);
    expect(successResponse.headers.get("x-correlation-id")).toBe("client-correlation-abc-999");
    expect(successResponse.headers.get("x-request-id")).toBeDefined();

    const successBody = await successResponse.json();
    expect(successBody.meta.supportId).toBe(successResponse.headers.get(SUPPORT_ID_HEADER));
    expect(successBody.meta.correlationId).toBe("client-correlation-abc-999");

    const failureResponse = apiFailure(
      request,
      new ApiError(401, "unauthorized", "Invalid signature"),
    );
    expect(failureResponse.headers.get(SUPPORT_ID_HEADER)).toMatch(/^sup_[a-f0-9]+/);
    expect(failureResponse.headers.get("x-correlation-id")).toBe("client-correlation-abc-999");

    const failureBody = await failureResponse.json();
    expect(failureBody.meta.supportId).toBe(failureResponse.headers.get(SUPPORT_ID_HEADER));
  });

  it("computes comprehensive SLO status verifying all reliability targets", () => {
    // Populate healthy metrics across all 9 SLI domains
    incrementCounter("api_requests_total", {
      method: "GET",
      path: "/api/v1/policies",
      status: "200",
    });
    recordHistogram("api_latency", 50, { method: "GET", path: "/api/v1/policies", status: "200" });
    incrementCounter("auth_requests_total", {
      operation: "challenge",
      status: "200",
      outcome: "success",
    });
    incrementCounter("api_requests_total", {
      method: "POST",
      path: "/api/v1/postage/settle",
      status: "200",
    });
    incrementCounter("relay_requests_total", {
      stage: "relay",
      status: "200",
      delivery_state: "ACKNOWLEDGED",
    });
    incrementCounter("chain_queue_operations_total", {
      operation: "settle",
      status: "200",
      outcome: "success",
    });
    incrementCounter("storage_operations_total", {
      backend: "r2",
      operation: "put",
      status: "200",
    });
    incrementCounter("provisioning_operations_total", {
      step: "reserve",
      status: "200",
      outcome: "success",
    });
    incrementCounter("sync_operations_total", { operation: "pull", status: "200" });

    const summary = computeSLOSummary();
    expect(summary.allMet).toBe(true);
    expect(summary.availability.met).toBe(true);
    expect(summary.latency.met).toBe(true);
    expect(summary.authAvailability.met).toBe(true);
    expect(summary.postageTransitions.met).toBe(true);
    expect(summary.relayDelivery.met).toBe(true);
    expect(summary.chainQueue.met).toBe(true);
    expect(summary.storageAvailability.met).toBe(true);
    expect(summary.provisioning.met).toBe(true);
    expect(summary.syncAvailability.met).toBe(true);
  });
});
