/**
 * Immutable crypto configuration validation (#1729).
 *
 * Algorithm identifiers, limits, and runtime capabilities are currently
 * implicit in code and not validated as one configuration. Misconfigured
 * deployments may fail only when a user attempts to send or open a message.
 *
 * This module creates an immutable, validated crypto configuration object
 * covering supported suites, limits, key resolvers, clocks, and runtime
 * primitives. Invalid combinations fail before any crypto operation is served.
 * Secret values (keys, tokens, credentials) are never included in validation
 * errors or configuration surfaces.
 *
 * Development and production requirements are explicit: dev mode allows test
 * overrides (injectable clocks, mock CSPRNG), while production requires real
 * Web Crypto and system time.
 */

import { SUITE_REGISTRY, isSupportedVersion, isSupportedSuite, isSuiteForVersion } from "./suites";
import { type Clock, systemClock } from "./time";
import { type RecipientKeyResolver } from "./key-resolver";
import { type CryptoTelemetryAdapter } from "./telemetry";
import { CryptoError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Deployment environment controls which runtime checks are enforced. */
export type CryptoEnvironment = "development" | "production";

/** Limits governing envelope and attachment sizes. */
export interface CryptoLimits {
  /** Maximum body plaintext size in bytes. */
  readonly maxBodyBytes: number;
  /** Maximum number of attachments per envelope. */
  readonly maxAttachments: number;
  /** Maximum per-attachment plaintext size in bytes. */
  readonly maxAttachmentBytes: number;
}

/** Runtime primitive requirements that must be available for crypto operations. */
export interface CryptoPrimitives {
  /** Whether `crypto.subtle` is available for AEAD operations. */
  readonly hasSubtleCrypto: boolean;
  /** Whether `crypto.getRandomValues` is available for nonce/key generation. */
  readonly hasSecureRandom: boolean;
}

/** Configuration for a recipient key resolver. */
export interface KeyResolverConfig {
  /** Whether a key resolver is provided and usable. */
  readonly available: boolean;
}

/** Clock configuration for timestamp validation. */
export interface ClockConfig {
  /** Whether a clock source is available. */
  readonly available: boolean;
  /** Whether the clock is the system clock (production) or injectable (dev). */
  readonly isSystemClock: boolean;
}

/**
 * The full, immutable crypto configuration object.
 *
 * All fields are readonly; the object is frozen after construction.
 * No secret material (keys, tokens, credentials) is stored or derivable
 * from this configuration.
 */
export interface CryptoConfig {
  /** Deployment environment. */
  readonly environment: CryptoEnvironment;
  /** Supported envelope version (from the suite registry). */
  readonly envelopeVersion: string;
  /** Supported algorithm suite names. */
  readonly suites: readonly string[];
  /** Body and attachment size/count limits. */
  readonly limits: CryptoLimits;
  /** Runtime primitive availability. */
  readonly primitives: CryptoPrimitives;
  /** Key resolver configuration. */
  readonly keyResolver: KeyResolverConfig;
  /** Clock source configuration. */
  readonly clock: ClockConfig;
  /** Telemetry adapter availability. */
  readonly telemetry: { readonly available: boolean };
  /** Whether the configuration has passed all validation checks. */
  readonly valid: boolean;
  /** Validation errors, if any. Empty when valid is true. */
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Default limits
// ---------------------------------------------------------------------------

/** Default production limits. */
export const DEFAULT_LIMITS: CryptoLimits = Object.freeze({
  maxBodyBytes: 64 * 1024, // 64 KiB
  maxAttachments: 16,
  maxAttachmentBytes: 16 * 1024 * 1024, // 16 MiB
});

/** Minimum acceptable limits (floor values). */
export const MIN_LIMITS: CryptoLimits = Object.freeze({
  maxBodyBytes: 1024, // 1 KiB minimum
  maxAttachments: 1,
  maxAttachmentBytes: 1024, // 1 KiB minimum
});

/** Maximum allowed limits (ceiling values to prevent misconfiguration). */
export const MAX_LIMITS: CryptoLimits = Object.freeze({
  maxBodyBytes: 256 * 1024 * 1024, // 256 MiB
  maxAttachments: 256,
  maxAttachmentBytes: 256 * 1024 * 1024, // 256 MiB
});

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Detect available crypto runtime primitives. This is evaluated once at
 * module load time so configuration validation reflects the actual runtime
 * capabilities, not a stale snapshot.
 */
export function detectPrimitives(): CryptoPrimitives {
  return Object.freeze({
    hasSubtleCrypto:
      typeof globalThis !== "undefined" &&
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.subtle !== "undefined",
    hasSecureRandom:
      typeof globalThis !== "undefined" &&
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.getRandomValues === "function",
  });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate limits are within acceptable bounds.
 * Returns an array of error strings (empty when valid).
 */
export function validateLimits(limits: CryptoLimits): string[] {
  const errors: string[] = [];

  if (typeof limits.maxBodyBytes !== "number" || !Number.isFinite(limits.maxBodyBytes)) {
    errors.push("limits.maxBodyBytes must be a finite number");
  } else if (limits.maxBodyBytes < MIN_LIMITS.maxBodyBytes) {
    errors.push(
      `limits.maxBodyBytes must be >= ${MIN_LIMITS.maxBodyBytes}, got ${limits.maxBodyBytes}`,
    );
  } else if (limits.maxBodyBytes > MAX_LIMITS.maxBodyBytes) {
    errors.push(
      `limits.maxBodyBytes must be <= ${MAX_LIMITS.maxBodyBytes}, got ${limits.maxBodyBytes}`,
    );
  }

  if (typeof limits.maxAttachments !== "number" || !Number.isFinite(limits.maxAttachments)) {
    errors.push("limits.maxAttachments must be a finite number");
  } else if (!Number.isInteger(limits.maxAttachments)) {
    errors.push("limits.maxAttachments must be an integer");
  } else if (limits.maxAttachments < MIN_LIMITS.maxAttachments) {
    errors.push(
      `limits.maxAttachments must be >= ${MIN_LIMITS.maxAttachments}, got ${limits.maxAttachments}`,
    );
  } else if (limits.maxAttachments > MAX_LIMITS.maxAttachments) {
    errors.push(
      `limits.maxAttachments must be <= ${MAX_LIMITS.maxAttachments}, got ${limits.maxAttachments}`,
    );
  }

  if (typeof limits.maxAttachmentBytes !== "number" || !Number.isFinite(limits.maxAttachmentBytes)) {
    errors.push("limits.maxAttachmentBytes must be a finite number");
  } else if (limits.maxAttachmentBytes < MIN_LIMITS.maxAttachmentBytes) {
    errors.push(
      `limits.maxAttachmentBytes must be >= ${MIN_LIMITS.maxAttachmentBytes}, got ${limits.maxAttachmentBytes}`,
    );
  } else if (limits.maxAttachmentBytes > MAX_LIMITS.maxAttachmentBytes) {
    errors.push(
      `limits.maxAttachmentBytes must be <= ${MAX_LIMITS.maxAttachmentBytes}, got ${limits.maxAttachmentBytes}`,
    );
  }

  return errors;
}

/**
 * Validate that a list of suite names are all registered and supported.
 * Returns an array of error strings (empty when valid).
 */
export function validateSuites(suites: readonly string[], envelopeVersion: string): string[] {
  const errors: string[] = [];

  if (!Array.isArray(suites) || suites.length === 0) {
    errors.push("at least one algorithm suite must be configured");
    return errors;
  }

  for (const suite of suites) {
    if (typeof suite !== "string" || suite.length === 0) {
      errors.push("suite names must be non-empty strings");
      continue;
    }
    if (!isSupportedSuite(suite)) {
      errors.push(`suite "${suite}" is not registered or not supported`);
    } else if (!isSuiteForVersion(suite, envelopeVersion)) {
      errors.push(`suite "${suite}" is not registered for envelope version "${envelopeVersion}"`);
    }
  }

  return errors;
}

/**
 * Validate that the envelope version is registered and supported.
 * Returns an error string or undefined.
 */
export function validateEnvelopeVersion(version: string): string | undefined {
  if (typeof version !== "string" || version.length === 0) {
    return "envelope version must be a non-empty string";
  }
  if (!isSupportedVersion(version)) {
    return `envelope version "${version}" is not registered or not supported`;
  }
  return undefined;
}

/**
 * Validate the runtime primitives match the environment requirements.
 * Production requires real Web Crypto; development can use test overrides.
 * Returns an array of error strings (empty when valid).
 */
export function validatePrimitives(
  primitives: CryptoPrimitives,
  environment: CryptoEnvironment,
): string[] {
  const errors: string[] = [];

  if (environment === "production") {
    if (!primitives.hasSubtleCrypto) {
      errors.push("production environment requires crypto.subtle (Web Crypto API)");
    }
    if (!primitives.hasSecureRandom) {
      errors.push("production environment requires crypto.getRandomValues (CSPRNG)");
    }
  }

  return errors;
}

/**
 * Validate the environment string itself.
 * Returns an error string or undefined.
 */
export function validateEnvironment(env: string): string | undefined {
  if (env !== "development" && env !== "production") {
    return `environment must be "development" or "production", got "${env}"`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Configuration builder
// ---------------------------------------------------------------------------

export interface CryptoConfigInput {
  /** Deployment environment. Default: "production". */
  environment?: CryptoEnvironment;
  /** Supported envelope version. Default: registry's latest supported. */
  envelopeVersion?: string;
  /** Supported algorithm suite names. Default: all registered supported suites. */
  suites?: string[];
  /** Body and attachment limits. Default: DEFAULT_LIMITS. */
  limits?: Partial<CryptoLimits>;
  /** Injected clock for timestamp validation. Default: systemClock. */
  clock?: Clock;
  /** Recipient key resolver. */
  keyResolver?: RecipientKeyResolver;
  /** Telemetry adapter. */
  telemetry?: CryptoTelemetryAdapter;
  /** Override runtime primitive detection (tests only, never production). */
  primitives?: CryptoPrimitives;
}

function defaultSuites(): string[] {
  return SUITE_REGISTRY.suites
    .filter((s) => s.status === "supported")
    .map((s) => s.name);
}

function defaultEnvelopeVersion(): string {
  for (const v of [...SUITE_REGISTRY.versions].reverse()) {
    if (v.status === "supported") return v.version;
  }
  throw new CryptoError("crypto_version_error", "no supported version available");
}

/**
 * Build and validate an immutable crypto configuration.
 *
 * Validates all inputs before constructing the frozen configuration object.
 * If any validation fails, the returned configuration has `valid: false` and
 * an `errors` array describing what went wrong — no secrets are included.
 *
 * The returned object is `Object.freeze()`d so callers cannot mutate it after
 * construction.
 */
export function buildCryptoConfig(input?: CryptoConfigInput): CryptoConfig {
  const environment = input?.environment ?? "production";
  const envelopeVersion = input?.envelopeVersion ?? defaultEnvelopeVersion();
  const suites = input?.suites ?? defaultSuites();
  const limits: CryptoLimits = Object.freeze({
    maxBodyBytes: input?.limits?.maxBodyBytes ?? DEFAULT_LIMITS.maxBodyBytes,
    maxAttachments: input?.limits?.maxAttachments ?? DEFAULT_LIMITS.maxAttachments,
    maxAttachmentBytes:
      input?.limits?.maxAttachmentBytes ?? DEFAULT_LIMITS.maxAttachmentBytes,
  });
  const primitives = input?.primitives ?? detectPrimitives();
  const clock = input?.clock ?? systemClock;
  const keyResolverAvailable = input?.keyResolver !== undefined && input?.keyResolver !== null;
  const telemetryAvailable = input?.telemetry !== undefined && input?.telemetry !== null;

  const errors: string[] = [];

  // Validate environment
  const envError = validateEnvironment(environment);
  if (envError) errors.push(envError);

  // Validate envelope version
  const versionError = validateEnvelopeVersion(envelopeVersion);
  if (versionError) errors.push(versionError);

  // Validate suites against the version
  if (!versionError) {
    errors.push(...validateSuites(suites, envelopeVersion));
  }

  // Validate limits
  errors.push(...validateLimits(limits));

  // Validate runtime primitives
  errors.push(...validatePrimitives(primitives, environment));

  const valid = errors.length === 0;

  return Object.freeze({
    environment: Object.freeze(environment as CryptoEnvironment),
    envelopeVersion: Object.freeze(envelopeVersion),
    suites: Object.freeze([...suites]),
    limits,
    primitives: Object.freeze({ ...primitives }),
    keyResolver: Object.freeze({ available: keyResolverAvailable }),
    clock: Object.freeze({
      available: true,
      isSystemClock: clock === systemClock,
    }),
    telemetry: Object.freeze({ available: telemetryAvailable }),
    valid,
    errors: Object.freeze([...errors]),
  });
}

// ---------------------------------------------------------------------------
// Singleton default configuration
// ---------------------------------------------------------------------------

let defaultConfig: CryptoConfig | undefined;

/**
 * Return the default (production) crypto configuration, built once and cached.
 * Use `resetCryptoConfig()` to clear the cache (e.g. in tests).
 */
export function getCryptoConfig(): CryptoConfig {
  if (!defaultConfig) {
    defaultConfig = buildCryptoConfig();
  }
  return defaultConfig;
}

/**
 * Reset the cached default configuration. Intended for use in tests that need
 * to validate different configurations. Never call in production.
 */
export function resetCryptoConfig(): void {
  defaultConfig = undefined;
}
