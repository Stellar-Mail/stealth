import { describe, expect, it, beforeEach } from "vitest";
import {
  buildCryptoConfig,
  getCryptoConfig,
  resetCryptoConfig,
  validateLimits,
  validateSuites,
  validateEnvelopeVersion,
  validatePrimitives,
  validateEnvironment,
  DEFAULT_LIMITS,
  MIN_LIMITS,
  MAX_LIMITS,
  detectPrimitives,
  type CryptoConfig,
  type CryptoConfigInput,
} from "../../../src/services/crypto/config";

const detectedPrimitives = detectPrimitives();
const hasRealCrypto = detectedPrimitives.hasSubtleCrypto && detectedPrimitives.hasSecureRandom;

describe("crypto configuration validation (#1729)", () => {
  beforeEach(() => {
    resetCryptoConfig();
  });

  // ---------------------------------------------------------------------------
  // buildCryptoConfig — valid configurations
  // ---------------------------------------------------------------------------

  describe("buildCryptoConfig — valid configurations", () => {
    it("builds a valid default production config when Web Crypto is available", () => {
      const config = buildCryptoConfig({
        primitives: { hasSubtleCrypto: true, hasSecureRandom: true },
      });
      expect(config.valid).toBe(true);
      expect(config.errors).toHaveLength(0);
      expect(config.environment).toBe("production");
      expect(config.envelopeVersion).toBe("v1");
      expect(config.suites).toContain("AES-256-GCM");
      expect(config.limits.maxBodyBytes).toBe(DEFAULT_LIMITS.maxBodyBytes);
      expect(config.limits.maxAttachments).toBe(DEFAULT_LIMITS.maxAttachments);
      expect(config.limits.maxAttachmentBytes).toBe(DEFAULT_LIMITS.maxAttachmentBytes);
    });

    it("builds a valid default development config in any environment", () => {
      const config = buildCryptoConfig({ environment: "development" });
      expect(config.valid).toBe(true);
      expect(config.environment).toBe("development");
    });

    it("builds a valid config with custom limits within bounds", () => {
      const config = buildCryptoConfig({
        environment: "development",
        limits: {
          maxBodyBytes: 32 * 1024,
          maxAttachments: 8,
          maxAttachmentBytes: 8 * 1024 * 1024,
        },
      });
      expect(config.valid).toBe(true);
      expect(config.limits.maxBodyBytes).toBe(32 * 1024);
      expect(config.limits.maxAttachments).toBe(8);
      expect(config.limits.maxAttachmentBytes).toBe(8 * 1024 * 1024);
    });

    it("builds a valid config with explicit suite list", () => {
      const config = buildCryptoConfig({
        environment: "development",
        suites: ["AES-256-GCM"],
      });
      expect(config.valid).toBe(true);
      expect(config.suites).toEqual(["AES-256-GCM"]);
    });

    it("builds a valid config with partial limits override", () => {
      const config = buildCryptoConfig({
        environment: "development",
        limits: { maxBodyBytes: 1024 },
      });
      expect(config.valid).toBe(true);
      expect(config.limits.maxBodyBytes).toBe(1024);
      expect(config.limits.maxAttachments).toBe(DEFAULT_LIMITS.maxAttachments);
    });

    it("marks keyResolver as available when provided", () => {
      const resolver = { resolve: async () => ({}) as any };
      const config = buildCryptoConfig({ keyResolver: resolver });
      expect(config.keyResolver.available).toBe(true);
    });

    it("marks keyResolver as unavailable when not provided", () => {
      const config = buildCryptoConfig();
      expect(config.keyResolver.available).toBe(false);
    });

    it("marks telemetry as available when provided", () => {
      const adapter = { record: () => {} };
      const config = buildCryptoConfig({ telemetry: adapter });
      expect(config.telemetry.available).toBe(true);
    });

    it("marks telemetry as unavailable when not provided", () => {
      const config = buildCryptoConfig();
      expect(config.telemetry.available).toBe(false);
    });

    it("detects system clock as default", () => {
      const config = buildCryptoConfig();
      expect(config.clock.available).toBe(true);
      expect(config.clock.isSystemClock).toBe(true);
    });

    it("marks non-system clock as not system clock", () => {
      const clock = { now: () => new Date(0) };
      const config = buildCryptoConfig({ clock });
      expect(config.clock.isSystemClock).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // buildCryptoConfig — immutable output
  // ---------------------------------------------------------------------------

  describe("buildCryptoConfig — immutability", () => {
    it("returns a frozen object", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config)).toBe(true);
    });

    it("freezes the suites array", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config.suites)).toBe(true);
    });

    it("freezes the limits object", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config.limits)).toBe(true);
    });

    it("freezes the primitives object", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config.primitives)).toBe(true);
    });

    it("freezes the errors array", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config.errors)).toBe(true);
    });

    it("freezes the keyResolver object", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config.keyResolver)).toBe(true);
    });

    it("freezes the clock object", () => {
      const config = buildCryptoConfig();
      expect(Object.isFrozen(config.clock)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // buildCryptoConfig — invalid configurations
  // ---------------------------------------------------------------------------

  describe("buildCryptoConfig — invalid configurations", () => {
    it("fails with invalid environment string", () => {
      const config = buildCryptoConfig({ environment: "staging" as any });
      expect(config.valid).toBe(false);
      expect(config.errors.length).toBeGreaterThan(0);
      expect(config.errors.some((e) => e.includes("environment"))).toBe(true);
    });

    it("fails with unsupported envelope version", () => {
      const config = buildCryptoConfig({ envelopeVersion: "v99" });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("v99"))).toBe(true);
    });

    it("fails with empty envelope version", () => {
      const config = buildCryptoConfig({ envelopeVersion: "" });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("non-empty"))).toBe(true);
    });

    it("fails with unregistered suite", () => {
      const config = buildCryptoConfig({ suites: ["ROT13"] });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("ROT13"))).toBe(true);
    });

    it("fails with empty suite list", () => {
      const config = buildCryptoConfig({ suites: [] });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("at least one"))).toBe(true);
    });

    it("fails with suite not registered for the version", () => {
      const config = buildCryptoConfig({
        envelopeVersion: "v1",
        suites: ["AES-128-GCM"],
      });
      expect(config.valid).toBe(false);
    });

    it("fails when maxBodyBytes is below minimum", () => {
      const config = buildCryptoConfig({
        limits: { maxBodyBytes: 100 },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("maxBodyBytes"))).toBe(true);
    });

    it("fails when maxBodyBytes exceeds maximum", () => {
      const config = buildCryptoConfig({
        limits: { maxBodyBytes: 1024 * 1024 * 1024 },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("maxBodyBytes"))).toBe(true);
    });

    it("fails when maxBodyBytes is not a number", () => {
      const config = buildCryptoConfig({
        limits: { maxBodyBytes: "not-a-number" as any },
      });
      expect(config.valid).toBe(false);
    });

    it("fails when maxBodyBytes is Infinity", () => {
      const config = buildCryptoConfig({
        limits: { maxBodyBytes: Infinity },
      });
      expect(config.valid).toBe(false);
    });

    it("fails when maxBodyBytes is NaN", () => {
      const config = buildCryptoConfig({
        limits: { maxBodyBytes: NaN },
      });
      expect(config.valid).toBe(false);
    });

    it("fails when maxAttachments is below minimum", () => {
      const config = buildCryptoConfig({
        limits: { maxAttachments: 0 },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("maxAttachments"))).toBe(true);
    });

    it("fails when maxAttachments is not an integer", () => {
      const config = buildCryptoConfig({
        limits: { maxAttachments: 1.5 },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("integer"))).toBe(true);
    });

    it("fails when maxAttachmentBytes is below minimum", () => {
      const config = buildCryptoConfig({
        limits: { maxAttachmentBytes: 0 },
      });
      expect(config.valid).toBe(false);
    });

    it("fails when maxAttachmentBytes exceeds maximum", () => {
      const config = buildCryptoConfig({
        limits: { maxAttachmentBytes: 1024 * 1024 * 1024 },
      });
      expect(config.valid).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // buildCryptoConfig — production primitive requirements
  // ---------------------------------------------------------------------------

  describe("buildCryptoConfig — production primitive requirements", () => {
    it("fails production when subtleCrypto is unavailable", () => {
      const config = buildCryptoConfig({
        environment: "production",
        primitives: { hasSubtleCrypto: false, hasSecureRandom: true },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("crypto.subtle"))).toBe(true);
    });

    it("fails production when secureRandom is unavailable", () => {
      const config = buildCryptoConfig({
        environment: "production",
        primitives: { hasSubtleCrypto: true, hasSecureRandom: false },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.some((e) => e.includes("getRandomValues"))).toBe(true);
    });

    it("fails production when both primitives are unavailable", () => {
      const config = buildCryptoConfig({
        environment: "production",
        primitives: { hasSubtleCrypto: false, hasSecureRandom: false },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("allows development without real primitives", () => {
      const config = buildCryptoConfig({
        environment: "development",
        primitives: { hasSubtleCrypto: false, hasSecureRandom: false },
      });
      expect(config.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // buildCryptoConfig — secret leakage prevention
  // ---------------------------------------------------------------------------

  describe("buildCryptoConfig — secret leakage prevention", () => {
    it("config object contains no high-entropy blobs", () => {
      const config = buildCryptoConfig();
      const json = JSON.stringify(config);
      expect(json).not.toMatch(/[0-9a-fA-F]{32,}/);
    });

    it("config object contains no explicit secret markers", () => {
      const config = buildCryptoConfig();
      const json = JSON.stringify(config).toLowerCase();
      expect(json).not.toContain("secret");
      expect(json).not.toContain("private");
      expect(json).not.toContain("password");
      expect(json).not.toContain("token");
      expect(json).not.toContain("credential");
    });

    it("config errors contain no secret material", () => {
      const config = buildCryptoConfig({
        envelopeVersion: "v99",
        suites: ["ROT13"],
      });
      for (const err of config.errors) {
        expect(err.toLowerCase()).not.toContain("secret");
        expect(err.toLowerCase()).not.toContain("private");
        expect(err).not.toMatch(/[0-9a-fA-F]{32,}/);
      }
    });

    it("error messages in invalid config do not contain key material patterns", () => {
      const config = buildCryptoConfig({
        environment: "staging" as any,
      });
      for (const err of config.errors) {
        expect(err).not.toMatch(/-----BEGIN/);
        expect(err).not.toMatch(/^[A-Za-z0-9+/]{40,}={0,2}$/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // validateLimits
  // ---------------------------------------------------------------------------

  describe("validateLimits", () => {
    it("returns no errors for valid limits", () => {
      expect(validateLimits(DEFAULT_LIMITS)).toHaveLength(0);
    });

    it("returns no errors for boundary minimum values", () => {
      expect(validateLimits(MIN_LIMITS)).toHaveLength(0);
    });

    it("returns no errors for boundary maximum values", () => {
      expect(validateLimits(MAX_LIMITS)).toHaveLength(0);
    });

    it("catches non-finite maxBodyBytes", () => {
      const errors = validateLimits({ ...DEFAULT_LIMITS, maxBodyBytes: NaN });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("catches non-integer maxAttachments", () => {
      const errors = validateLimits({ ...DEFAULT_LIMITS, maxAttachments: 2.5 });
      expect(errors.some((e) => e.includes("integer"))).toBe(true);
    });

    it("catches multiple limit violations at once", () => {
      const errors = validateLimits({
        maxBodyBytes: -1,
        maxAttachments: -1,
        maxAttachmentBytes: -1,
      });
      expect(errors.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // validateSuites
  // ---------------------------------------------------------------------------

  describe("validateSuites", () => {
    it("returns no errors for supported suites on v1", () => {
      expect(validateSuites(["AES-256-GCM"], "v1")).toHaveLength(0);
    });

    it("catches unregistered suite name", () => {
      const errors = validateSuites(["ROT13"], "v1");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("catches empty suite array", () => {
      const errors = validateSuites([], "v1");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("at least one"))).toBe(true);
    });

    it("catches non-string suite entries", () => {
      const errors = validateSuites([123 as any], "v1");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("catches suite not registered for the given version", () => {
      const errors = validateSuites(["AES-256-GCM"], "v99");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // validateEnvelopeVersion
  // ---------------------------------------------------------------------------

  describe("validateEnvelopeVersion", () => {
    it("returns undefined for v1", () => {
      expect(validateEnvelopeVersion("v1")).toBeUndefined();
    });

    it("returns error for unknown version", () => {
      expect(validateEnvelopeVersion("v99")).toBeDefined();
    });

    it("returns error for empty string", () => {
      expect(validateEnvelopeVersion("")).toBeDefined();
    });

    it("returns error for non-string", () => {
      expect(validateEnvelopeVersion(42 as any)).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // validatePrimitives
  // ---------------------------------------------------------------------------

  describe("validatePrimitives", () => {
    it("returns no errors for production with real primitives", () => {
      const errors = validatePrimitives(
        { hasSubtleCrypto: true, hasSecureRandom: true },
        "production",
      );
      expect(errors).toHaveLength(0);
    });

    it("returns errors for production without real primitives", () => {
      const errors = validatePrimitives(
        { hasSubtleCrypto: false, hasSecureRandom: false },
        "production",
      );
      expect(errors.length).toBe(2);
    });

    it("returns no errors for development without primitives", () => {
      const errors = validatePrimitives(
        { hasSubtleCrypto: false, hasSecureRandom: false },
        "development",
      );
      expect(errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // validateEnvironment
  // ---------------------------------------------------------------------------

  describe("validateEnvironment", () => {
    it("returns undefined for development", () => {
      expect(validateEnvironment("development")).toBeUndefined();
    });

    it("returns undefined for production", () => {
      expect(validateEnvironment("production")).toBeUndefined();
    });

    it("returns error for unknown environment", () => {
      expect(validateEnvironment("staging")).toBeDefined();
    });

    it("returns error for empty string", () => {
      expect(validateEnvironment("")).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // detectPrimitives
  // ---------------------------------------------------------------------------

  describe("detectPrimitives", () => {
    it("detects crypto.subtle availability", () => {
      const p = detectPrimitives();
      expect(typeof p.hasSubtleCrypto).toBe("boolean");
    });

    it("detects crypto.getRandomValues availability", () => {
      const p = detectPrimitives();
      expect(typeof p.hasSecureRandom).toBe("boolean");
    });

    it("returns a frozen object", () => {
      expect(Object.isFrozen(detectPrimitives())).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getCryptoConfig / resetCryptoConfig
  // ---------------------------------------------------------------------------

  describe("getCryptoConfig / resetCryptoConfig", () => {
    it("returns the same cached instance on repeated calls", () => {
      const a = getCryptoConfig();
      const b = getCryptoConfig();
      expect(a).toBe(b);
    });

    it("returns a fresh instance after reset", () => {
      const a = getCryptoConfig();
      resetCryptoConfig();
      const b = getCryptoConfig();
      expect(a).not.toBe(b);
      expect(a.valid).toBe(b.valid);
    });

    it("default config is valid and production in Web Crypto environments", () => {
      if (hasRealCrypto) {
        const config = getCryptoConfig();
        expect(config.valid).toBe(true);
        expect(config.environment).toBe("production");
      } else {
        const config = getCryptoConfig();
        expect(config.environment).toBe("production");
        expect(config.errors.some((e) => e.includes("crypto.subtle") || e.includes("getRandomValues"))).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Comprehensive integration — all invalid combos fail before serving
  // ---------------------------------------------------------------------------

  describe("invalid combinations fail before serving", () => {
    it("unknown version + unknown suite + missing primitives", () => {
      const config = buildCryptoConfig({
        environment: "production",
        envelopeVersion: "v99",
        suites: ["ROT13"],
        primitives: { hasSubtleCrypto: false, hasSecureRandom: false },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("valid version with mismatched suite", () => {
      const config = buildCryptoConfig({
        envelopeVersion: "v1",
        suites: ["AES-128-GCM"],
      });
      expect(config.valid).toBe(false);
    });

    it("out-of-bounds limits with invalid environment", () => {
      const config = buildCryptoConfig({
        environment: "staging" as any,
        limits: { maxBodyBytes: -1 },
      });
      expect(config.valid).toBe(false);
      expect(config.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
