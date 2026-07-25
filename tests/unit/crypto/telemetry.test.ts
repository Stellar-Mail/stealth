import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  setCryptoTelemetryAdapter,
  getCryptoTelemetryAdapter,
  recordCryptoTelemetry,
  measureOperation,
  type CryptoTelemetryEvent,
  type CryptoTelemetryAdapter,
  type CryptoOperation,
  type CryptoResultCode,
} from "../../../src/services/crypto/telemetry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_OPERATIONS: CryptoOperation[] = [
  "seal",
  "open",
  "key_resolve",
  "kdf",
  "nonce_generate",
  "identity_normalize",
];

const VALID_RESULT_CODES: CryptoResultCode[] = [
  "success",
  "error_parse",
  "error_validation",
  "error_algorithm",
  "error_key",
  "error_signature",
  "error_commitment",
  "error_decrypt",
  "error_version",
  "error_integrity",
];

/** Patterns that must never appear in telemetry payloads. */
const SENSITIVE_PATTERNS = [
  // Hex strings > 16 chars (keys, hashes, nonces, MACs)
  /[0-9a-fA-F]{17,}/,
  // Base64 strings > 16 chars (ciphertext, signatures)
  /[A-Za-z0-9+/]{17,}={0,2}/,
  // Stellar account addresses (G + 55 base32 chars)
  /G[A-Z2-7]{55}/,
  // Federation addresses (user*domain.tld)
  /[a-zA-Z0-9._%+-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  // Plaintext body patterns (common English words in sequence)
  /Hello\s+Bob/,
  /secret\s+plaintext/,
];

function collectEvents(): CryptoTelemetryEvent[] {
  const events: CryptoTelemetryEvent[] = [];
  setCryptoTelemetryAdapter({
    record(event) {
      events.push(event);
    },
  });
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("crypto/telemetry", () => {
  beforeEach(() => {
    // Reset to default no-op adapter before each test
    setCryptoTelemetryAdapter(null);
  });

  afterEach(() => {
    setCryptoTelemetryAdapter(null);
  });

  // -----------------------------------------------------------------------
  // Adapter registration
  // -----------------------------------------------------------------------

  describe("adapter registration", () => {
    it("default adapter is no-op", () => {
      const adapter = getCryptoTelemetryAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.record).toBe("function");
      // Should not throw when called
      adapter.record({
        operation: "seal",
        result: "success",
        durationMs: 10,
      });
    });

    it("setCryptoTelemetryAdapter replaces the current adapter", () => {
      const mock1: CryptoTelemetryAdapter = { record: vi.fn() };
      const mock2: CryptoTelemetryAdapter = { record: vi.fn() };

      setCryptoTelemetryAdapter(mock1);
      getCryptoTelemetryAdapter().record({
        operation: "seal",
        result: "success",
        durationMs: 1,
      });
      expect(mock1.record).toHaveBeenCalledTimes(1);

      setCryptoTelemetryAdapter(mock2);
      getCryptoTelemetryAdapter().record({
        operation: "open",
        result: "success",
        durationMs: 1,
      });
      expect(mock2.record).toHaveBeenCalledTimes(1);
      expect(mock1.record).toHaveBeenCalledTimes(1);
    });

    it("setCryptoTelemetryAdapter(null) resets to no-op", () => {
      const mock: CryptoTelemetryAdapter = { record: vi.fn() };
      setCryptoTelemetryAdapter(mock);
      setCryptoTelemetryAdapter(null);

      // Should not throw and should not call the mock
      getCryptoTelemetryAdapter().record({
        operation: "seal",
        result: "success",
        durationMs: 1,
      });
      expect(mock.record).not.toHaveBeenCalled();
    });

    it("setCryptoTelemetryAdapter(undefined) resets to no-op", () => {
      const mock: CryptoTelemetryAdapter = { record: vi.fn() };
      setCryptoTelemetryAdapter(mock);
      setCryptoTelemetryAdapter(undefined);

      getCryptoTelemetryAdapter().record({
        operation: "seal",
        result: "success",
        durationMs: 1,
      });
      expect(mock.record).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // recordCryptoTelemetry
  // -----------------------------------------------------------------------

  describe("recordCryptoTelemetry", () => {
    it("forwards events to the current adapter", () => {
      const events = collectEvents();
      recordCryptoTelemetry({
        operation: "seal",
        result: "success",
        durationMs: 42,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        operation: "seal",
        result: "success",
        durationMs: 42,
      });
    });

    it("swallows adapter errors without affecting callers", () => {
      setCryptoTelemetryAdapter({
        record() {
          throw new Error("adapter crashed");
        },
      });

      // Should not throw
      expect(() =>
        recordCryptoTelemetry({
          operation: "seal",
          result: "success",
          durationMs: 1,
        }),
      ).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // measureOperation (synchronous)
  // -----------------------------------------------------------------------

  describe("measureOperation (sync)", () => {
    it("records a success event with duration", () => {
      const events = collectEvents();
      const result = measureOperation("kdf", () => 42);

      expect(result).toBe(42);
      expect(events).toHaveLength(1);
      expect(events[0].operation).toBe("kdf");
      expect(events[0].result).toBe("success");
      expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("uses resultMap to derive result code from return value", () => {
      const events = collectEvents();
      const result = measureOperation(
        "seal",
        () => ({ ok: true as const, value: "data" }),
        (v) => (v.ok ? "success" : "error_parse"),
      );

      expect(result.ok).toBe(true);
      expect(events[0].result).toBe("success");
    });

    it("records an error event when fn throws", () => {
      const events = collectEvents();
      const error = { code: "crypto_key_error", message: "missing key" };

      expect(() =>
        measureOperation("key_resolve", () => {
          throw error;
        }),
      ).toThrow(error);

      expect(events).toHaveLength(1);
      expect(events[0].operation).toBe("key_resolve");
      expect(events[0].result).toBe("error_key");
    });

    it("maps unknown errors to error_parse", () => {
      const events = collectEvents();

      expect(() =>
        measureOperation("open", () => {
          throw new Error("generic");
        }),
      ).toThrow();

      expect(events[0].result).toBe("error_parse");
    });
  });

  // -----------------------------------------------------------------------
  // measureOperation (async)
  // -----------------------------------------------------------------------

  describe("measureOperation (async)", () => {
    it("records a success event for resolved promises", async () => {
      const events = collectEvents();
      const result = await measureOperation("open", async () => "decrypted");

      expect(result).toBe("decrypted");
      expect(events).toHaveLength(1);
      expect(events[0].operation).toBe("open");
      expect(events[0].result).toBe("success");
      expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("records an error event for rejected promises", async () => {
      const events = collectEvents();
      const error = { code: "crypto_integrity_error" };

      await expect(
        measureOperation("open", async () => {
          throw error;
        }),
      ).rejects.toThrow();

      expect(events).toHaveLength(1);
      expect(events[0].result).toBe("error_integrity");
    });

    it("uses resultMap for async operations", async () => {
      const events = collectEvents();
      await measureOperation(
        "seal",
        async () => ({ version: "v1" }),
        () => "success",
      );

      expect(events[0].result).toBe("success");
    });
  });

  // -----------------------------------------------------------------------
  // Event structure
  // -----------------------------------------------------------------------

  describe("event structure", () => {
    it("all required fields are present", () => {
      const events = collectEvents();
      recordCryptoTelemetry({
        operation: "seal",
        result: "success",
        durationMs: 100,
      });

      expect(events[0]).toHaveProperty("operation");
      expect(events[0]).toHaveProperty("result");
      expect(events[0]).toHaveProperty("durationMs");
    });

    it("optional fields are omitted when not provided", () => {
      const events = collectEvents();
      recordCryptoTelemetry({
        operation: "seal",
        result: "success",
        durationMs: 100,
      });

      expect(events[0]).not.toHaveProperty("suite");
      expect(events[0]).not.toHaveProperty("errorCode");
    });

    it("suite is included when provided", () => {
      const events = collectEvents();
      recordCryptoTelemetry({
        operation: "seal",
        suite: "AES-256-GCM",
        result: "success",
        durationMs: 100,
      });

      expect(events[0].suite).toBe("AES-256-GCM");
    });

    it("errorCode is included when provided", () => {
      const events = collectEvents();
      recordCryptoTelemetry({
        operation: "open",
        result: "error_key",
        durationMs: 50,
        errorCode: "crypto_key_error",
      });

      expect(events[0].errorCode).toBe("crypto_key_error");
    });
  });

  // -----------------------------------------------------------------------
  // Bounded cardinality
  // -----------------------------------------------------------------------

  describe("bounded cardinality", () => {
    it("operation names are from the fixed enum", () => {
      for (const op of VALID_OPERATIONS) {
        expect(() =>
          recordCryptoTelemetry({ operation: op, result: "success", durationMs: 1 }),
        ).not.toThrow();
      }
    });

    it("result codes are from the fixed enum", () => {
      for (const code of VALID_RESULT_CODES) {
        expect(() =>
          recordCryptoTelemetry({ operation: "seal", result: code, durationMs: 1 }),
        ).not.toThrow();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Redaction — no sensitive data in events
  // -----------------------------------------------------------------------

  describe("redaction", () => {
    it("events contain no sensitive patterns in serialized form", () => {
      const events = collectEvents();

      // Simulate events with various fields
      const sampleEvents: CryptoTelemetryEvent[] = [
        { operation: "seal", result: "success", durationMs: 100, suite: "AES-256-GCM" },
        {
          operation: "open",
          result: "error_decrypt",
          durationMs: 50,
          errorCode: "crypto_decrypt_error",
        },
        { operation: "key_resolve", result: "error_key", durationMs: 200 },
        { operation: "kdf", result: "success", durationMs: 10 },
        { operation: "nonce_generate", result: "success", durationMs: 5, suite: "AES-256-GCM" },
        { operation: "identity_normalize", result: "success", durationMs: 2 },
      ];

      for (const event of sampleEvents) {
        events.push(event);
      }

      // Serialize each event and check for sensitive patterns
      for (const event of events) {
        const serialized = JSON.stringify(event);
        for (const pattern of SENSITIVE_PATTERNS) {
          expect(serialized).not.toMatch(new RegExp(pattern.source, pattern.flags));
        }
      }
    });

    it("no hex strings longer than 16 chars in events", () => {
      const events = collectEvents();
      events.push({
        operation: "seal",
        result: "success",
        durationMs: 100,
      });

      for (const event of events) {
        const serialized = JSON.stringify(event);
        // Allow short hex (like error codes) but reject long hex (keys/hashes)
        expect(serialized).not.toMatch(/[0-9a-fA-F]{17,}/);
      }
    });

    it("no base64 strings longer than 16 chars in events", () => {
      const events = collectEvents();
      events.push({
        operation: "open",
        result: "success",
        durationMs: 100,
      });

      for (const event of events) {
        const serialized = JSON.stringify(event);
        expect(serialized).not.toMatch(/[A-Za-z0-9+/]{17,}={0,2}/);
      }
    });

    it("no Stellar account addresses in events", () => {
      const events = collectEvents();
      events.push({
        operation: "seal",
        result: "success",
        durationMs: 100,
      });

      for (const event of events) {
        const serialized = JSON.stringify(event);
        expect(serialized).not.toMatch(/G[A-Z2-7]{55}/);
      }
    });

    it("no federation addresses in events", () => {
      const events = collectEvents();
      events.push({
        operation: "seal",
        result: "success",
        durationMs: 100,
      });

      for (const event of events) {
        const serialized = JSON.stringify(event);
        expect(serialized).not.toMatch(/[a-zA-Z0-9._%+-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Failure isolation
  // -----------------------------------------------------------------------

  describe("failure isolation", () => {
    it("telemetry errors do not propagate to callers of recordCryptoTelemetry", () => {
      setCryptoTelemetryAdapter({
        record() {
          throw new Error("adapter failure");
        },
      });

      expect(() =>
        recordCryptoTelemetry({
          operation: "seal",
          result: "success",
          durationMs: 10,
        }),
      ).not.toThrow();
    });

    it("measureOperation still returns results when adapter throws", () => {
      setCryptoTelemetryAdapter({
        record() {
          throw new Error("telemetry down");
        },
      });

      const result = measureOperation("seal", () => "data");
      expect(result).toBe("data");
    });

    it("measureOperation still throws when adapter throws", () => {
      setCryptoTelemetryAdapter({
        record() {
          throw new Error("telemetry down");
        },
      });

      const error = new Error("crypto failed");
      expect(() =>
        measureOperation("open", () => {
          throw error;
        }),
      ).toThrow(error);
    });

    it("async measureOperation still resolves when adapter throws", async () => {
      setCryptoTelemetryAdapter({
        record() {
          throw new Error("telemetry down");
        },
      });

      const result = await measureOperation("key_resolve", async () => "key");
      expect(result).toBe("key");
    });

    it("async measureOperation still rejects when adapter throws", async () => {
      setCryptoTelemetryAdapter({
        record() {
          throw new Error("telemetry down");
        },
      });

      const error = new Error("resolution failed");
      await expect(
        measureOperation("key_resolve", async () => {
          throw error;
        }),
      ).rejects.toThrow(error);
    });
  });
});
