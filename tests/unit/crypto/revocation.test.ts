import { describe, expect, it } from "vitest";

import {
  enforceRecipientNotRevoked,
  enforceSignerNotRevoked,
  filterRevokedRecipients,
  createActiveKey,
  createRevokedKey,
  SYSTEM_CLOCK,
  type KeyWithRevocation,
  type Clock,
  type SealRevocationOptions,
  type VerifyRevocationOptions,
} from "../../../src/services/crypto/revocation";

import { CryptoError } from "../../../src/services/crypto/errors";

/**
 * Controllable clock for timestamp policy testing.
 * Allows tests to freeze time and verify revocation at specific moments.
 */
function createTestClock(isoTimestamp: string): Clock {
  return {
    now: () => new Date(isoTimestamp),
  };
}

describe("revocation status enforcement", () => {
  describe("enforceRecipientNotRevoked", () => {
    it("allows sealing to an active (non-revoked) recipient key", () => {
      const recipient = createActiveKey("recipient-key-12345678");
      expect(() => enforceRecipientNotRevoked(recipient)).not.toThrow();
    });

    it("rejects sealing to a revoked recipient key with crypto_key_error", () => {
      const recipient = createRevokedKey(
        "recipient-key-87654321",
        "2026-01-15T10:00:00Z",
        "Key compromised",
      );

      expect(() => enforceRecipientNotRevoked(recipient)).toThrow(CryptoError);

      try {
        enforceRecipientNotRevoked(recipient);
      } catch (error) {
        expect(error).toBeInstanceOf(CryptoError);
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_key_error");
          // CryptoError uses a fixed public message that doesn't leak details
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
        }
      }
    });

    it("uses fixed public message that doesn't leak key IDs", () => {
      const longKeyId = "0123456789abcdef0123456789abcdef0123456789abcdef";
      const recipient = createRevokedKey(longKeyId, "2026-01-15T10:00:00Z");

      try {
        enforceRecipientNotRevoked(recipient);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error instanceof CryptoError) {
          // CryptoError always uses fixed public message, never includes key IDs
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
          expect(error.message).not.toContain(longKeyId);
          expect(error.message).not.toContain("01234567");
        }
      }
    });

    it("throws when revocation metadata is missing and requireRevocationData is true (default)", () => {
      const recipient: KeyWithRevocation = {
        keyId: "key-no-revocation",
        revocation: null as any,
      };

      expect(() => enforceRecipientNotRevoked(recipient)).toThrow(CryptoError);

      try {
        enforceRecipientNotRevoked(recipient);
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_key_error");
          // Uses fixed public message for security
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
        }
      }
    });

    it("allows sealing when revocation metadata is missing if requireRevocationData is false", () => {
      const recipient: KeyWithRevocation = {
        keyId: "key-no-revocation",
        revocation: null as any,
      };

      const options: SealRevocationOptions = {
        requireRevocationData: false,
      };

      expect(() => enforceRecipientNotRevoked(recipient, options)).not.toThrow();
    });

    it("uses fixed public message for empty key IDs", () => {
      const recipient = createRevokedKey("", "2026-01-15T10:00:00Z");

      try {
        enforceRecipientNotRevoked(recipient);
      } catch (error) {
        if (error instanceof CryptoError) {
          // CryptoError uses fixed public message
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
        }
      }
    });
  });

  describe("enforceSignerNotRevoked", () => {
    it("allows verification of an active (non-revoked) signer key", () => {
      const signer = createActiveKey("signer-key-12345678");
      expect(() => enforceSignerNotRevoked(signer)).not.toThrow();
    });

    it("rejects a revoked signer at verification-time policy with crypto_signature_error", () => {
      const signer = createRevokedKey(
        "signer-key-87654321",
        "2026-01-15T10:00:00Z",
        "Key compromised",
      );

      const clock = createTestClock("2026-07-23T12:00:00Z"); // Current time (after revocation)

      const options: VerifyRevocationOptions = {
        clock,
        timestampPolicy: "verification-time",
      };

      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);

      try {
        enforceSignerNotRevoked(signer, options);
      } catch (error) {
        expect(error).toBeInstanceOf(CryptoError);
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_signature_error");
          // CryptoError uses a fixed public message for security
          expect(error.message).toBe("The envelope signature is invalid");
        }
      }
    });

    it("allows signatures created before revocation with signing-time policy", () => {
      const signer = createRevokedKey("signer-key-12345678", "2026-01-20T10:00:00Z");

      const options: VerifyRevocationOptions = {
        timestampPolicy: "signing-time",
        signedAt: "2026-01-10T09:00:00Z", // Signed before revocation
      };

      // Should not throw because signature was created before revocation
      expect(() => enforceSignerNotRevoked(signer, options)).not.toThrow();
    });

    it("rejects signatures created at the exact revocation moment with signing-time policy", () => {
      const revocationTime = "2026-01-20T10:00:00Z";
      const signer = createRevokedKey("signer-key-12345678", revocationTime);

      const options: VerifyRevocationOptions = {
        timestampPolicy: "signing-time",
        signedAt: revocationTime, // Signed exactly at revocation time
      };

      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);

      try {
        enforceSignerNotRevoked(signer, options);
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_signature_error");
        }
      }
    });

    it("rejects signatures created after revocation with signing-time policy", () => {
      const signer = createRevokedKey("signer-key-12345678", "2026-01-20T10:00:00Z");

      const options: VerifyRevocationOptions = {
        timestampPolicy: "signing-time",
        signedAt: "2026-01-25T12:00:00Z", // Signed after revocation
      };

      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);

      try {
        enforceSignerNotRevoked(signer, options);
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_signature_error");
        }
      }
    });

    it("uses system clock when no clock is provided for verification-time policy", () => {
      const signer = createActiveKey("signer-key-12345678");

      const options: VerifyRevocationOptions = {
        timestampPolicy: "verification-time",
        // No clock provided, should use SYSTEM_CLOCK
      };

      expect(() => enforceSignerNotRevoked(signer, options)).not.toThrow();
    });

    it("defaults to verification-time policy when timestampPolicy is not specified", () => {
      const signer = createRevokedKey("signer-key-12345678", "2025-01-01T00:00:00Z");

      const clock = createTestClock("2026-07-23T12:00:00Z"); // After revocation

      const options: VerifyRevocationOptions = {
        clock,
        // timestampPolicy not specified, should default to "verification-time"
      };

      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);
    });

    it("treats revoked keys without revokedAt timestamp as always invalid", () => {
      const signer: KeyWithRevocation = {
        keyId: "signer-key-12345678",
        revocation: {
          revoked: true,
          // revokedAt is missing
        },
      };

      const options: VerifyRevocationOptions = {
        timestampPolicy: "signing-time",
        signedAt: "2026-01-01T00:00:00Z", // Even very old signatures fail
      };

      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);

      try {
        enforceSignerNotRevoked(signer, options);
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_signature_error");
        }
      }
    });

    it("throws when revocation metadata is missing and requireRevocationData is true (default)", () => {
      const signer: KeyWithRevocation = {
        keyId: "key-no-revocation",
        revocation: null as any,
      };

      expect(() => enforceSignerNotRevoked(signer)).toThrow(CryptoError);

      try {
        enforceSignerNotRevoked(signer);
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_signature_error");
          // Uses fixed public message for security
          expect(error.message).toBe("The envelope signature is invalid");
        }
      }
    });

    it("allows verification when revocation metadata is missing if requireRevocationData is false", () => {
      const signer: KeyWithRevocation = {
        keyId: "key-no-revocation",
        revocation: null as any,
      };

      const options: VerifyRevocationOptions = {
        requireRevocationData: false,
      };

      expect(() => enforceSignerNotRevoked(signer, options)).not.toThrow();
    });

    it("uses fixed public message that doesn't leak key IDs", () => {
      const longKeyId = "fedcba9876543210fedcba9876543210fedcba9876543210";
      const signer = createRevokedKey(longKeyId, "2026-01-15T10:00:00Z");

      const clock = createTestClock("2026-07-23T12:00:00Z");

      try {
        enforceSignerNotRevoked(signer, { clock, timestampPolicy: "verification-time" });
        throw new Error("Should have thrown");
      } catch (error) {
        if (error instanceof CryptoError) {
          // CryptoError always uses fixed public message
          expect(error.message).toBe("The envelope signature is invalid");
          expect(error.message).not.toContain(longKeyId);
          expect(error.message).not.toContain("fedcba98");
        }
      }
    });

    it("uses fixed public message without revealing revocation timestamp", () => {
      const revocationTime = "2026-01-20T10:00:00Z";
      const signer = createRevokedKey("signer-key-12345678", revocationTime);

      const clock = createTestClock("2026-07-23T12:00:00Z");

      try {
        enforceSignerNotRevoked(signer, { clock, timestampPolicy: "verification-time" });
      } catch (error) {
        if (error instanceof CryptoError) {
          // CryptoError uses fixed public message that doesn't leak timestamps
          expect(error.message).toBe("The envelope signature is invalid");
          expect(error.message).not.toContain(revocationTime);
        }
      }
    });
  });

  describe("filterRevokedRecipients", () => {
    it("returns all recipients when none are revoked", () => {
      const recipients = [
        createActiveKey("recipient-1"),
        createActiveKey("recipient-2"),
        createActiveKey("recipient-3"),
      ];

      const valid = filterRevokedRecipients(recipients);

      expect(valid).toHaveLength(3);
      expect(valid).toEqual(recipients);
    });

    it("filters out revoked recipients and returns only valid ones", () => {
      const recipients = [
        createActiveKey("recipient-1"),
        createRevokedKey("recipient-2", "2026-01-15T10:00:00Z"),
        createActiveKey("recipient-3"),
        createRevokedKey("recipient-4", "2026-02-20T14:00:00Z"),
        createActiveKey("recipient-5"),
      ];

      const valid = filterRevokedRecipients(recipients);

      expect(valid).toHaveLength(3);
      expect(valid.map((k) => k.keyId)).toEqual(["recipient-1", "recipient-3", "recipient-5"]);
    });

    it("returns empty array when all recipients are revoked", () => {
      const recipients = [
        createRevokedKey("recipient-1", "2026-01-15T10:00:00Z"),
        createRevokedKey("recipient-2", "2026-02-20T14:00:00Z"),
      ];

      const valid = filterRevokedRecipients(recipients);

      expect(valid).toHaveLength(0);
    });

    it("throws immediately with failFast when encountering a revoked key", () => {
      const recipients = [
        createActiveKey("recipient-1"),
        createRevokedKey("recipient-2", "2026-01-15T10:00:00Z"),
        createActiveKey("recipient-3"), // Should not be checked due to failFast
      ];

      expect(() => filterRevokedRecipients(recipients, { failFast: true })).toThrow(CryptoError);

      try {
        filterRevokedRecipients(recipients, { failFast: true });
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.code).toBe("crypto_key_error");
          // Uses fixed public message for security
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
        }
      }
    });

    it("continues filtering without throwing when failFast is false (default)", () => {
      const recipients = [
        createActiveKey("recipient-1"),
        createRevokedKey("recipient-2", "2026-01-15T10:00:00Z"),
        createActiveKey("recipient-3"),
      ];

      const valid = filterRevokedRecipients(recipients);

      expect(valid).toHaveLength(2);
      expect(valid.map((k) => k.keyId)).toEqual(["recipient-1", "recipient-3"]);
    });

    it("respects requireRevocationData option for each recipient", () => {
      const recipients = [
        createActiveKey("recipient-1"),
        { keyId: "recipient-2", revocation: null as any } as KeyWithRevocation,
        createActiveKey("recipient-3"),
      ];

      // With requireRevocationData: false, the recipient with missing metadata is allowed
      const valid = filterRevokedRecipients(recipients, { requireRevocationData: false });

      expect(valid).toHaveLength(3);
    });

    it("filters out recipients with missing metadata when requireRevocationData is true", () => {
      const recipients = [
        createActiveKey("recipient-1"),
        { keyId: "recipient-2", revocation: null as any } as KeyWithRevocation,
        createActiveKey("recipient-3"),
      ];

      // With requireRevocationData: true (default), the recipient with missing metadata is filtered
      const valid = filterRevokedRecipients(recipients);

      expect(valid).toHaveLength(2);
      expect(valid.map((k) => k.keyId)).toEqual(["recipient-1", "recipient-3"]);
    });
  });

  describe("clock injection for testability", () => {
    it("SYSTEM_CLOCK returns current date-time", () => {
      const before = Date.now();
      const systemTime = SYSTEM_CLOCK.now().getTime();
      const after = Date.now();

      expect(systemTime).toBeGreaterThanOrEqual(before);
      expect(systemTime).toBeLessThanOrEqual(after);
    });

    it("test clock can be frozen to a specific timestamp", () => {
      const frozenTime = "2026-03-15T14:30:00Z";
      const testClock = createTestClock(frozenTime);

      const time1 = testClock.now();
      const time2 = testClock.now();

      // JavaScript Date.toISOString() always includes milliseconds (.000)
      expect(time1.toISOString()).toBe("2026-03-15T14:30:00.000Z");
      expect(time2.toISOString()).toBe("2026-03-15T14:30:00.000Z");
      expect(time1).toEqual(time2);
    });

    it("revocation decisions use injected clock for timestamp comparison", () => {
      const signer = createRevokedKey("signer-key-12345678", "2026-03-15T12:00:00Z");

      // Clock set to before revocation
      const clockBefore = createTestClock("2026-03-15T11:00:00Z");
      // For verification-time policy, clock determines "now"
      // But key is already revoked in metadata, so we need signing-time policy for this test

      // Actually, let's test verification-time with clock after revocation
      const clockAfter = createTestClock("2026-03-15T13:00:00Z");

      expect(() =>
        enforceSignerNotRevoked(signer, {
          clock: clockAfter,
          timestampPolicy: "verification-time",
        }),
      ).toThrow(CryptoError);

      // Now test with signing-time where signature was before revocation
      expect(() =>
        enforceSignerNotRevoked(signer, {
          clock: clockAfter,
          timestampPolicy: "signing-time",
          signedAt: "2026-03-15T11:00:00Z",
        }),
      ).not.toThrow();
    });
  });

  describe("helper functions", () => {
    it("createActiveKey produces a non-revoked key metadata object", () => {
      const key = createActiveKey("test-key-12345678");

      expect(key.keyId).toBe("test-key-12345678");
      expect(key.revocation.revoked).toBe(false);
      expect(key.revocation.revokedAt).toBeUndefined();
      expect(key.revocation.reason).toBeUndefined();
    });

    it("createRevokedKey produces a revoked key metadata object with timestamp", () => {
      const key = createRevokedKey("test-key-87654321", "2026-01-15T10:00:00Z", "Compromised");

      expect(key.keyId).toBe("test-key-87654321");
      expect(key.revocation.revoked).toBe(true);
      expect(key.revocation.revokedAt).toBe("2026-01-15T10:00:00Z");
      expect(key.revocation.reason).toBe("Compromised");
    });

    it("createRevokedKey allows optional reason parameter", () => {
      const key = createRevokedKey("test-key-87654321", "2026-01-15T10:00:00Z");

      expect(key.revocation.revoked).toBe(true);
      expect(key.revocation.revokedAt).toBe("2026-01-15T10:00:00Z");
      expect(key.revocation.reason).toBeUndefined();
    });
  });

  describe("error message security", () => {
    it("error messages use fixed public strings without key material", () => {
      const fullKey = "G" + "A".repeat(55); // 56 character Stellar-style public key
      const recipient = createRevokedKey(fullKey, "2026-01-15T10:00:00Z");

      try {
        enforceRecipientNotRevoked(recipient);
      } catch (error) {
        if (error instanceof CryptoError) {
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
          expect(error.message).not.toContain(fullKey);
          expect(error.message.length).toBeLessThan(100); // Ensure message is concise
        }
      }
    });

    it("error messages never include revocation reasons (prevents information disclosure)", () => {
      const sensitiveReason = "User alice@example.com reported key theft from device #12345";
      const recipient = createRevokedKey("key-12345678", "2026-01-15T10:00:00Z", sensitiveReason);

      try {
        enforceRecipientNotRevoked(recipient);
      } catch (error) {
        if (error instanceof CryptoError) {
          // The revocation reason should never appear in the error message
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
          expect(error.message).not.toContain("alice@example.com");
          expect(error.message).not.toContain("#12345");
          expect(error.message).not.toContain(sensitiveReason);
        }
      }
    });

    it("batch filtering uses fixed public messages without leaking key information", () => {
      const recipients = [
        createActiveKey("safe-key-1"),
        createRevokedKey("compromised-key-2", "2026-01-15T10:00:00Z"),
        createActiveKey("safe-key-3"),
      ];

      try {
        filterRevokedRecipients(recipients, { failFast: true });
      } catch (error) {
        if (error instanceof CryptoError) {
          // Error should use fixed public message, not mentioning any specific keys
          expect(error.message).toBe("A required cryptographic key was missing or unusable");
          expect(error.message).not.toContain("compromised");
          expect(error.message).not.toContain("safe-key-1");
          expect(error.message).not.toContain("safe-key-3");
        }
      }
    });
  });

  describe("timestamp policy edge cases", () => {
    it("handles ISO 8601 timestamps with different timezone formats", () => {
      const signer = createRevokedKey("key-12345678", "2026-01-15T10:00:00+00:00");

      const options: VerifyRevocationOptions = {
        timestampPolicy: "signing-time",
        signedAt: "2026-01-15T05:00:00-05:00", // 5 AM EST = 10 AM UTC (same moment)
      };

      // Should throw because signature was at the exact revocation moment
      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);
    });

    it("handles signing-time policy with signedAt one millisecond before revocation", () => {
      const signer = createRevokedKey("key-12345678", "2026-01-15T10:00:00.000Z");

      const options: VerifyRevocationOptions = {
        timestampPolicy: "signing-time",
        signedAt: "2026-01-15T09:59:59.999Z", // 1ms before revocation
      };

      // Should allow because signature was before revocation
      expect(() => enforceSignerNotRevoked(signer, options)).not.toThrow();
    });

    it("defaults to verification-time and uses provided clock when signedAt is missing", () => {
      const signer = createRevokedKey("key-12345678", "2026-01-15T10:00:00Z");

      const clock = createTestClock("2026-07-23T12:00:00Z");

      const options: VerifyRevocationOptions = {
        clock,
        timestampPolicy: "signing-time",
        // signedAt is missing, should fall back to clock.now()
      };

      expect(() => enforceSignerNotRevoked(signer, options)).toThrow(CryptoError);
    });
  });
});
