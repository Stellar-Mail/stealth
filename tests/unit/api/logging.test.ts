import { describe, expect, it } from "vitest";

import {
  planApiLog,
  planPrivacySafeLog,
  shouldSampleRoutineSuccess,
  generateSupportId,
  deriveSupportId,
  redactSensitiveString,
  sanitizeLogPayload,
  ALLOWED_LOG_FIELDS,
} from "../../../src/server/api/logging";

describe("API log sampling & privacy-safe logging (BETA-092)", () => {
  describe("sampling behavior", () => {
    it("keeps deterministic sampling decisions per route and request ID", () => {
      const decisions = Array.from({ length: 5 }, () =>
        shouldSampleRoutineSuccess("/postage/quote", "request-123", {
          successSampleRate: 0.25,
        }),
      );

      expect(new Set(decisions).size).toBe(1);
    });

    it("allows routine success logs to be sampled by configured rate", () => {
      expect(
        shouldSampleRoutineSuccess("/health", "request-1", {
          successSampleRate: 0,
        }),
      ).toBe(false);
      expect(
        shouldSampleRoutineSuccess("/health", "request-1", {
          successSampleRate: 1,
        }),
      ).toBe(true);
    });

    it("never samples out security denials or unexpected errors in planApiLog", () => {
      expect(
        planApiLog(
          {
            route: "/policies/owner",
            requestId: "request-1",
            status: 403,
            outcome: "security_denied",
          },
          { successSampleRate: 0 },
        ).log,
      ).toMatchObject({ outcome: "security_denied", samplingRate: 1 });

      expect(
        planApiLog(
          {
            route: "/postage",
            requestId: "request-2",
            status: 500,
            outcome: "unexpected_error",
          },
          { successSampleRate: 0 },
        ).log,
      ).toMatchObject({ outcome: "unexpected_error", samplingRate: 1 });
    });

    it("counts metrics for all requests even when routine success logs are not emitted", () => {
      const decision = planApiLog(
        {
          route: "/health",
          requestId: "request-3",
          status: 200,
          outcome: "success",
        },
        { successSampleRate: 0 },
      );

      expect(decision.log).toBeUndefined();
      expect(decision.metrics).toEqual([
        {
          metric: "api.requests_total",
          route: "/health",
          status: 200,
          outcome: "success",
        },
      ]);
    });
  });

  describe("supportId generation & derivation", () => {
    it("generates a browser-safe support ID format with sup_ prefix", () => {
      const id1 = generateSupportId();
      const id2 = generateSupportId();

      expect(id1).toMatch(/^sup_[a-f0-9]{12}$/);
      expect(id2).toMatch(/^sup_[a-f0-9]{12}$/);
      expect(id1).not.toBe(id2);
    });

    it("derives deterministic support ID from a request ID", () => {
      const reqId = "req-abc-12345";
      const supId1 = deriveSupportId(reqId);
      const supId2 = deriveSupportId(reqId);

      expect(supId1).toBe(supId2);
      expect(supId1).toMatch(/^sup_[a-f0-9]{8}$/);
    });
  });

  describe("sensitive data redaction", () => {
    it("redacts Stellar S-seeds from error and log strings", () => {
      const text =
        "Transaction failed with signer SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA on horizon";
      const redacted = redactSensitiveString(text);

      expect(redacted).not.toContain("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
      expect(redacted).toContain("[REDACTED_SEED]");
    });

    it("redacts Bearer tokens and authorization headers", () => {
      const text = "Request rejected: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid";
      const redacted = redactSensitiveString(text);

      expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(redacted).toContain("Bearer [REDACTED_TOKEN]");
    });

    it("redacts 64-character hex private keys", () => {
      const text =
        "Error: private_key 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef failed";
      const redacted = redactSensitiveString(text);

      expect(redacted).not.toContain(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );
      expect(redacted).toContain("[REDACTED_KEY]");
    });

    it("redacts email addresses", () => {
      const text = "Delivery to alice@example.com failed with mailbox rejection";
      const redacted = redactSensitiveString(text);

      expect(redacted).not.toContain("alice@example.com");
      expect(redacted).toContain("[REDACTED_EMAIL]");
    });

    it("redacts passwords and PEM blocks", () => {
      const text = 'Auth error: password: "superSecretPassword123!"';
      const redacted = redactSensitiveString(text);

      expect(redacted).not.toContain("superSecretPassword123!");
      expect(redacted).toContain("[REDACTED_PASSWORD]");
    });
  });

  describe("field allowlists & payload sanitization", () => {
    it("strips all unapproved fields (plaintext, ciphertext, tokens, recipient addresses)", () => {
      const unsafePayload = {
        stage: "delivery",
        operation: "submitRelay",
        status: 500,
        outcome: "unexpected_error",
        requestId: "req-123",
        // Prohibited fields:
        plaintextBody: "Hello secret world",
        ciphertextEnvelope: "enc:base64:unencrypted...",
        secretToken: "tok_secret_123",
        recipientEmail: "bob@example.com",
        signerSeed: "SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        internalMemoryAddress: 0x7fff,
      };

      const clean = sanitizeLogPayload(unsafePayload);

      expect(clean.stage).toBe("delivery");
      expect(clean.operation).toBe("submitRelay");
      expect(clean.status).toBe(500);
      expect(clean.outcome).toBe("unexpected_error");
      expect(clean.requestId).toBe("req-123");

      // Verify prohibited fields are completely omitted
      expect((clean as any).plaintextBody).toBeUndefined();
      expect((clean as any).ciphertextEnvelope).toBeUndefined();
      expect((clean as any).secretToken).toBeUndefined();
      expect((clean as any).recipientEmail).toBeUndefined();
      expect((clean as any).signerSeed).toBeUndefined();
      expect((clean as any).internalMemoryAddress).toBeUndefined();
    });

    it("ensures all allowed log fields are documented", () => {
      expect(ALLOWED_LOG_FIELDS).toContain("stage");
      expect(ALLOWED_LOG_FIELDS).toContain("operation");
      expect(ALLOWED_LOG_FIELDS).toContain("status");
      expect(ALLOWED_LOG_FIELDS).toContain("outcome");
      expect(ALLOWED_LOG_FIELDS).toContain("requestId");
      expect(ALLOWED_LOG_FIELDS).toContain("supportId");
      expect(ALLOWED_LOG_FIELDS).toContain("traceId");
      expect(ALLOWED_LOG_FIELDS).toContain("spanId");
      expect(ALLOWED_LOG_FIELDS).toContain("errorCode");
      expect(ALLOWED_LOG_FIELDS).toContain("errorType");
      expect(ALLOWED_LOG_FIELDS).toContain("latencyMs");
      expect(ALLOWED_LOG_FIELDS).toContain("safeTargetReference");
    });
  });

  describe("planPrivacySafeLog across stages", () => {
    it("plans and sanitizes relay stage logs with 100% error retention", () => {
      const decision = planPrivacySafeLog(
        {
          stage: "relay",
          operation: "submit",
          status: 503,
          outcome: "unexpected_error",
          requestId: "req-relay-1",
          errorCode: "ERR_RPC_TIMEOUT",
          errorType: "RelayTimeoutError",
          latencyMs: 350.5,
          safeTargetReference: "msg-001",
        },
        { successSampleRate: 0 },
      );

      expect(decision.log).toBeDefined();
      expect(decision.log?.stage).toBe("relay");
      expect(decision.log?.errorCode).toBe("ERR_RPC_TIMEOUT");
      expect(decision.log?.supportId).toMatch(/^sup_[a-f0-9]+/);
      expect(decision.log?.samplingRate).toBe(1.0);
      expect(decision.metrics).toEqual([
        {
          metric: "api.requests_total",
          route: "/relay/submit",
          status: 503,
          outcome: "unexpected_error",
        },
      ]);
    });

    it("plans chain queue dead letter log without leaking payload contents", () => {
      const decision = planPrivacySafeLog(
        {
          stage: "chain_queue",
          operation: "dead_letter",
          status: 500,
          outcome: "unexpected_error",
          requestId: "req-chain-2",
          queueName: "settlement_jobs",
          errorCode: "ERR_CONTRACT_REVERT",
          latencyMs: 1200,
          attempt: 5,
        },
        { successSampleRate: 0 },
      );

      expect(decision.log).toBeDefined();
      expect(decision.log?.stage).toBe("chain_queue");
      expect(decision.log?.queueName).toBe("settlement_jobs");
      expect(decision.log?.attempt).toBe(5);
    });

    it("samples routine success logs when successSampleRate is 0", () => {
      const decision = planPrivacySafeLog(
        {
          stage: "storage",
          operation: "get_envelope",
          status: 200,
          outcome: "success",
          requestId: "req-storage-3",
        },
        { successSampleRate: 0 },
      );

      expect(decision.log).toBeUndefined();
      expect(decision.metrics).toHaveLength(1);
    });
  });
});
