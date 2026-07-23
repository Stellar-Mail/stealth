/**
 * Fail-closed crypto suite registry.
 *
 * Single source of truth for supported envelope versions and algorithm suites.
 * Every version/suite combination must be explicitly registered; unknown and
 * deprecated entries are rejected with stable, non-secret errors. The registry
 * prevents silent downgrade attacks by refusing any combination that is not
 * explicitly registered with "supported" status.
 *
 * Adding a new algorithm or version requires:
 *  1. A new entry in `SUITE_REGISTRY.suites` (or `versions`).
 *  2. Linking the suite name into the corresponding version's `suites` array.
 *  3. Updating the nonce map in `nonce.ts` if nonce length differs.
 *  4. Adding encryption/decryption support in `envelope.ts` / `open-envelope.ts`.
 */

import { CryptoError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle status of a version or suite entry. */
export type SuiteStatus = "supported" | "deprecated";

/**
 * Exact parameter requirements for a single algorithm suite.
 * `webCryptoName` maps to the Web Crypto `Algorithm.name` identifier.
 */
export interface SuiteDefinition {
  readonly name: string;
  readonly keyBits: number;
  readonly nonceBytes: number;
  readonly webCryptoName: string;
  readonly status: SuiteStatus;
}

/**
 * A registered envelope version and the suite names it permits.
 */
export interface VersionEntry {
  readonly version: string;
  readonly suites: readonly string[];
  readonly status: SuiteStatus;
}

// ---------------------------------------------------------------------------
// Registry — the single source of truth
// ---------------------------------------------------------------------------

export const SUITE_REGISTRY = {
  versions: [
    { version: "v1", suites: ["AES-256-GCM"], status: "supported" },
  ] as readonly VersionEntry[],

  suites: [
    {
      name: "AES-256-GCM",
      keyBits: 256,
      nonceBytes: 12,
      webCryptoName: "AES-GCM",
      status: "supported",
    },
  ] as readonly SuiteDefinition[],
} as const;

// ---------------------------------------------------------------------------
// Internal lookup maps (built once, lazily)
// ---------------------------------------------------------------------------

let versionMap: Map<string, VersionEntry> | undefined;
let suiteMap: Map<string, SuiteDefinition> | undefined;

function getVersionMap(): Map<string, VersionEntry> {
  if (!versionMap) {
    versionMap = new Map(SUITE_REGISTRY.versions.map((v) => [v.version, v]));
  }
  return versionMap;
}

function getSuiteMap(): Map<string, SuiteDefinition> {
  if (!suiteMap) {
    suiteMap = new Map(SUITE_REGISTRY.suites.map((s) => [s.name, s]));
  }
  return suiteMap;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Return the `VersionEntry` if it exists, otherwise `undefined`. */
export function getVersion(version: string): VersionEntry | undefined {
  return getVersionMap().get(version);
}

/** Return the `SuiteDefinition` if it exists, otherwise `undefined`. */
export function getSuite(name: string): SuiteDefinition | undefined {
  return getSuiteMap().get(name);
}

/** Check if a version is registered and has "supported" status. */
export function isSupportedVersion(version: string): boolean {
  const entry = getVersionMap().get(version);
  return entry !== undefined && entry.status === "supported";
}

/** Check if a suite is registered and has "supported" status. */
export function isSupportedSuite(name: string): boolean {
  const entry = getSuiteMap().get(name);
  return entry !== undefined && entry.status === "supported";
}

/**
 * Check if a specific suite is registered for a given version.
 * Both the version and suite must be "supported" for this to return `true`.
 */
export function isSuiteForVersion(suiteName: string, version: string): boolean {
  const versionEntry = getVersionMap().get(version);
  if (!versionEntry || versionEntry.status !== "supported") return false;
  if (!versionEntry.suites.includes(suiteName)) return false;
  const suiteEntry = getSuiteMap().get(suiteName);
  return suiteEntry !== undefined && suiteEntry.status === "supported";
}

// ---------------------------------------------------------------------------
// Validation (fail-closed)
// ---------------------------------------------------------------------------

/**
 * Validate that a version and suite combination is explicitly registered and
 * supported. Throws `CryptoError` with a stable code on failure.
 *
 * Validation order: version first, then suite, then pairing. This ensures
 * an unknown version is reported as a version error even if the suite is
 * also unknown (preventing information leakage via error ordering).
 */
export function validateVersionAndSuite(version: string, suiteName: string): void {
  const versionEntry = getVersionMap().get(version);

  if (!versionEntry) {
    throw new CryptoError("crypto_version_error", `unsupported envelope version: ${version}`);
  }

  if (versionEntry.status === "deprecated") {
    throw new CryptoError("crypto_version_error", `deprecated envelope version: ${version}`);
  }

  const suiteEntry = getSuiteMap().get(suiteName);

  if (!suiteEntry) {
    throw new CryptoError("crypto_algorithm_error", `unsupported algorithm suite: ${suiteName}`);
  }

  if (suiteEntry.status === "deprecated") {
    throw new CryptoError("crypto_algorithm_error", `deprecated algorithm suite: ${suiteName}`);
  }

  if (!versionEntry.suites.includes(suiteName)) {
    throw new CryptoError(
      "crypto_algorithm_error",
      `algorithm ${suiteName} is not registered for envelope version ${version}`,
    );
  }
}

/**
 * Validate that a version is acceptable for opening (decrypting) an envelope.
 * Deprecated versions are accepted here (for backward compatibility) but
 * never for sealing.
 */
export function validateVersionForOpen(version: string): void {
  const versionEntry = getVersionMap().get(version);

  if (!versionEntry) {
    throw new CryptoError("crypto_version_error", `unsupported envelope version: ${version}`);
  }
}

/**
 * Validate that a suite is acceptable for opening (decrypting) an envelope.
 * Deprecated suites are accepted here (for backward compatibility) but
 * never for sealing.
 */
export function validateSuiteForOpen(suiteName: string): void {
  const suiteEntry = getSuiteMap().get(suiteName);

  if (!suiteEntry) {
    throw new CryptoError("crypto_algorithm_error", `unsupported algorithm suite: ${suiteName}`);
  }
}

/**
 * Validate that a version+suite pair is acceptable for opening.
 * Deprecated entries are accepted; unknown entries are rejected.
 */
export function validateNegotiationForOpen(version: string, suiteName: string): void {
  validateVersionForOpen(version);
  validateSuiteForOpen(suiteName);

  const versionEntry = getVersionMap().get(version)!;
  if (!versionEntry.suites.includes(suiteName)) {
    throw new CryptoError(
      "crypto_algorithm_error",
      `algorithm ${suiteName} is not registered for envelope version ${version}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Default suite lookup
// ---------------------------------------------------------------------------

/**
 * Return the first supported suite for the latest supported version.
 * Used by `sealEnvelope` to determine which algorithm to use for encryption.
 */
export function getDefaultSuite(): SuiteDefinition {
  for (const versionEntry of [...SUITE_REGISTRY.versions].reverse()) {
    if (versionEntry.status !== "supported") continue;
    for (const suiteName of versionEntry.suites) {
      const suiteEntry = getSuiteMap().get(suiteName);
      if (suiteEntry && suiteEntry.status === "supported") {
        return suiteEntry;
      }
    }
  }
  throw new CryptoError("crypto_algorithm_error", "no supported suite available");
}

/**
 * Return the latest supported envelope version string.
 */
export function getDefaultVersion(): string {
  for (const versionEntry of [...SUITE_REGISTRY.versions].reverse()) {
    if (versionEntry.status === "supported") {
      return versionEntry.version;
    }
  }
  throw new CryptoError("crypto_version_error", "no supported version available");
}

// ---------------------------------------------------------------------------
// Registry integrity (used by tests and health checks)
// ---------------------------------------------------------------------------

/**
 * Verify internal consistency of the registry:
 * - Every suite listed in a version entry exists in the suites array.
 * - Every version entry is reachable.
 * - No duplicate names within each level.
 */
export function validateRegistryIntegrity(): void {
  const suiteNames = SUITE_REGISTRY.suites.map((s) => s.name);
  const versionNames = SUITE_REGISTRY.versions.map((v) => v.version);

  // Check for duplicate suite names.
  if (new Set(suiteNames).size !== suiteNames.length) {
    throw new CryptoError("crypto_algorithm_error", "duplicate suite names in registry");
  }

  // Check for duplicate version names.
  if (new Set(versionNames).size !== versionNames.length) {
    throw new CryptoError("crypto_version_error", "duplicate version names in registry");
  }

  // Every suite referenced by a version must exist in the suites array.
  for (const versionEntry of SUITE_REGISTRY.versions) {
    for (const suiteName of versionEntry.suites) {
      if (!getSuiteMap().has(suiteName)) {
        throw new CryptoError(
          "crypto_algorithm_error",
          `version ${versionEntry.version} references unknown suite ${suiteName}`,
        );
      }
    }
  }
}
