import { ApiError } from "../errors";

export interface AuthenticationEnvelope {
  /** The explicit version of the authentication scheme (e.g., "STEALTH-AUTH-V1") */
  readonly version: string;
  /** The public key ID or address used for verification (supports key rotation) */
  readonly keyId: string;
  /** The base64-encoded signature */
  readonly signature: string;
}

export interface AuthVerifierConfig {
  /** A bounded set of active verification schemes/versions */
  readonly activeVersions: ReadonlySet<string>;
}

/**
 * Validates the authentication envelope version against the configured active versions.
 * Throws a stable 'unauthorized' error if the version is deprecated or unrecognized.
 */
export function validateAuthVersion(version: string, config: AuthVerifierConfig): void {
  if (!config.activeVersions.has(version)) {
    throw new ApiError("unauthorized", { version });
  }
}
