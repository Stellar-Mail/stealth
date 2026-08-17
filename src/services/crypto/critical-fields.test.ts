import { describe, expect, it, beforeEach } from "vitest";
import {
  validateCriticalFields,
  registerCriticalField,
  resetRegisteredCriticalFields,
  isKnownCriticalField,
  getRegisteredCriticalFields,
  KNOWN_STANDARD_CRITICAL_FIELDS,
} from "./critical-fields";
import { envelopePayloadSchema } from "./schema";
import { CryptoError } from "./errors";

describe("services/crypto/critical-fields", () => {
  beforeEach(() => {
    resetRegisteredCriticalFields();
  });

  const validBasePayload = {
    version: "v1",
    sender: "GABC123456789SENDERADDRESSSTEALTH01",
    recipient: "GABC123456789RECIPIENTADDRESSSTEAL01",
    timestamp: new Date().toISOString(),
    encryption_metadata: {
      algorithm: "AES-256-GCM",
      nonce: "00112233445566778899aabb",
      mac: "00112233445566778899aabbccddeeff",
    },
    content_commitment:
      "v1:sha256:hex:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    attachments: [],
  };

  it("validates known standard critical fields successfully", () => {
    const payload = {
      ...validBasePayload,
      critical: ["version", "sender", "recipient", "timestamp"],
    };

    expect(() => validateCriticalFields(payload)).not.toThrow();
  });

  it("validates registered critical extension fields successfully", () => {
    registerCriticalField("ext_security_policy");

    expect(isKnownCriticalField("ext_security_policy")).toBe(true);

    const payload = {
      ...validBasePayload,
      ext_security_policy: "strict-v2",
      critical: ["sender", "ext_security_policy"],
    };

    expect(() => validateCriticalFields(payload)).not.toThrow();
  });

  it("fails closed when unknown critical field names are present", () => {
    const payload = {
      ...validBasePayload,
      unknown_mandatory_field: "some-value",
      critical: ["unknown_mandatory_field"],
    };

    try {
      validateCriticalFields(payload);
      expect.fail("Should have thrown CryptoError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(CryptoError);
      expect(err.code).toBe("crypto_validation_error");
      expect(err.details).toContain("Unknown mandatory critical field: unknown_mandatory_field");
    }
  });

  it("fails closed when duplicate entries exist in the critical array", () => {
    const payload = {
      ...validBasePayload,
      critical: ["sender", "recipient", "sender"],
    };

    try {
      validateCriticalFields(payload);
      expect.fail("Should have thrown CryptoError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(CryptoError);
      expect(err.code).toBe("crypto_validation_error");
      expect(err.details).toContain("Duplicate entry in critical array: sender");
    }
  });

  it("fails closed when a field listed in critical is missing from the payload", () => {
    registerCriticalField("ext_required_hdr");

    const payload = {
      ...validBasePayload,
      // ext_required_hdr is NOT defined on payload
      critical: ["ext_required_hdr"],
    };

    try {
      validateCriticalFields(payload);
      expect.fail("Should have thrown CryptoError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(CryptoError);
      expect(err.code).toBe("crypto_validation_error");
      expect(err.details).toContain("Missing mandatory critical field value: ext_required_hdr");
    }
  });

  it("allows unknown optional fields that are NOT listed in critical (compatibility policy)", () => {
    const payload = {
      ...validBasePayload,
      unknown_optional_extension: "ignored-by-old-clients",
      another_optional_field: 12345,
      critical: ["sender", "recipient"],
    };

    expect(() => validateCriticalFields(payload)).not.toThrow();
  });

  it("integrates with envelopePayloadSchema Zod refinement", () => {
    const validWithCritical = {
      ...validBasePayload,
      critical: ["sender", "recipient"],
    };

    expect(() => envelopePayloadSchema.parse(validWithCritical)).not.toThrow();

    const invalidUnknownCritical = {
      ...validBasePayload,
      unrecognized_ext: "value",
      critical: ["unrecognized_ext"],
    };

    expect(() => envelopePayloadSchema.parse(invalidUnknownCritical)).toThrow();
  });

  it("returns registered critical fields combining defaults and extensions", () => {
    registerCriticalField("ext_audit_id");
    const fields = getRegisteredCriticalFields();

    expect(fields.has("version")).toBe(true);
    expect(fields.has("ext_audit_id")).toBe(true);
  });
});
