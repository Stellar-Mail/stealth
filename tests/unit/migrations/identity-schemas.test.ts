import { describe, expect, it } from "vitest";

import {
  applyBackward,
  applyForward,
  readEnvelope,
  wrapEnvelope,
} from "../../../src/server/migrations/envelope";
import {
  verificationSchema,
  walletMetadataSchema,
} from "../../../src/server/migrations/identity-schemas";
import { identityRecordFamilies } from "../../../src/server/migrations/adapters";

describe("identity record schemas (BETA-024)", () => {
  describe("verificationSchema", () => {
    it("accepts a pending verification with a code digest", () => {
      const result = verificationSchema.safeParse({
        verificationId: "v_1",
        subject: "relay-testnet.stealth.mail",
        method: "otp",
        status: "pending",
        codeDigest: "a".repeat(64),
        attempts: 2,
        expiresAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a raw (unhashed) code as the digest", () => {
      const result = verificationSchema.safeParse({
        verificationId: "v_1",
        subject: "alice",
        method: "otp",
        status: "pending",
        codeDigest: "123456",
        attempts: 0,
        expiresAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects records that omit required fields or use an unknown method", () => {
      const missing = verificationSchema.safeParse({
        subject: "alice",
        method: "otp",
        status: "pending",
      });
      expect(missing.success).toBe(false);

      const unknownMethod = verificationSchema.safeParse({
        verificationId: "v_1",
        subject: "alice",
        method: "sms",
        status: "pending",
        expiresAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      expect(unknownMethod.success).toBe(false);
    });
  });

  describe("walletMetadataSchema", () => {
    it("accepts a valid wallet metadata record", () => {
      const result = walletMetadataSchema.safeParse({
        address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        userId: "u_1",
        displayName: "Alice",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-Stellar addresses", () => {
      const result = walletMetadataSchema.safeParse({
        address: "0xabc",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("envelope helpers", () => {
    it("treats unversioned legacy records as version 1", () => {
      expect(readEnvelope({ userId: "u_1" })).toEqual({
        version: 1,
        payload: { userId: "u_1" },
      });
    });

    it("reads and writes the $v marker", () => {
      const wrapped = wrapEnvelope({ a: 1 }, 2);
      expect(readEnvelope(wrapped)).toEqual({ version: 2, payload: { a: 1 } });
    });

    it("returns null when a required forward step is missing", () => {
      const family = { ...identityRecordFamilies[0], currentVersion: 3 };
      const result = applyForward(family, wrapEnvelope({ userId: "u_1" }, 1));
      expect(result).toBeNull();
    });

    it("returns null when the rollback target is invalid", () => {
      const family = { ...identityRecordFamilies[0], currentVersion: 2 };
      const result = applyBackward(family, wrapEnvelope({ userId: "u_1" }, 2), 0);
      expect(result).toBeNull();
    });
  });
});
