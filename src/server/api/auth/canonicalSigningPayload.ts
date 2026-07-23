import { verify as cryptoVerify, createHmac, type KeyObject } from "node:crypto";
import { computeBodyHash } from "./bodyHash";

export const DEFAULT_CANONICAL_VERSION = "v1";
export const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_CLOCK_SKEW_MS = 30 * 1000; // 30 seconds

export interface CanonicalPayloadInput {
  version?: string;
  method: string;
  route: string;
  body?: unknown;
  bodyHash?: string;
  nonce: string;
  issuedAt: string | number;
  audience: string;
}

export type CustomVerifier = (payload: string, signature: string) => boolean;

export interface VerifyCanonicalRequestOptions {
  expectedVersion?: string;
  expectedAudience: string;
  expectedMethod?: string;
  expectedRoute?: string;
  expectedBodyHash?: string;
  method: string;
  route: string;
  body?: unknown;
  bodyHash?: string;
  nonce: string;
  issuedAt: string | number;
  audience: string;
  signature: string;
  publicKeyOrSecret?: string | Buffer | KeyObject;
  verifier?: CustomVerifier;
  nowMs?: number;
  maxAgeMs?: number;
  clockSkewMs?: number;
}

export type VerificationFailureReason =
  | "VERSION_MISMATCH"
  | "METHOD_MISMATCH"
  | "ROUTE_MISMATCH"
  | "BODY_MISMATCH"
  | "AUDIENCE_MISMATCH"
  | "TIMESTAMP_INVALID"
  | "NONCE_INVALID"
  | "SIGNATURE_INVALID";

export interface VerificationResult {
  valid: boolean;
  reason?: VerificationFailureReason;
  error?: string;
  canonicalPayload?: string;
}

/**
 * Normalizes a route or URL to a canonical route string.
 * Examples:
 * - `/auth/login/` -> `/auth/login`
 * - `/auth/login` -> `/auth/login`
 * - `auth/login/` -> `/auth/login`
 * - `https://example.com/api/auth/login?q=1#ref` -> `/api/auth/login`
 * - `/` -> `/`
 */
export function canonicalizeRoute(route: string): string {
  let path = route.trim();

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      // Fall back if URL parsing fails
    }
  }

  const queryIndex = path.indexOf("?");
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex);
  }
  const hashIndex = path.indexOf("#");
  if (hashIndex !== -1) {
    path = path.slice(0, hashIndex);
  }

  path = path.replace(/\/+/g, "/");

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

/**
 * Registry for versioned payload builders to support version coexistence.
 */
const payloadBuilders: Record<string, (input: CanonicalPayloadInput) => string> = {
  v1: buildV1CanonicalSigningPayload,
};

/**
 * Registers a new canonical payload builder version for future extensions.
 */
export function registerPayloadBuilder(
  version: string,
  builder: (input: CanonicalPayloadInput) => string,
): void {
  payloadBuilders[version.trim()] = builder;
}

/**
 * Builds the canonical payload string for v1 requests.
 * Format:
 * <version>
 * <UPPERCASE_METHOD>
 * <CANONICAL_ROUTE>
 * <SHA256_BODY_HASH>
 * nonce=<NONCE>
 * iat=<ISSUED_AT>
 * aud=<AUDIENCE>
 */
export function buildV1CanonicalSigningPayload(input: CanonicalPayloadInput): string {
  const version = (input.version ?? DEFAULT_CANONICAL_VERSION).trim();
  const method = input.method.trim().toUpperCase();
  const route = canonicalizeRoute(input.route);
  const hash = input.bodyHash ?? computeBodyHash(input.body);
  const nonce = input.nonce.trim();
  const iat = String(input.issuedAt).trim();
  const aud = input.audience.trim();

  return [version, method, route, hash, `nonce=${nonce}`, `iat=${iat}`, `aud=${aud}`].join("\n");
}

/**
 * Builds a deterministic canonical signing payload string based on version.
 */
export function buildCanonicalSigningPayload(input: CanonicalPayloadInput): string {
  const version = (input.version ?? DEFAULT_CANONICAL_VERSION).trim();
  const builder = payloadBuilders[version];
  if (!builder) {
    throw new Error(`Unsupported canonical payload version: ${version}`);
  }
  return builder(input);
}

/**
 * Validates whether an issued_at timestamp falls within the allowed time window.
 */
export function validateCanonicalTimestamp(
  issuedAt: string | number,
  nowMs = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  clockSkewMs = DEFAULT_CLOCK_SKEW_MS,
): boolean {
  const timestampMs =
    typeof issuedAt === "number"
      ? issuedAt < 1e11
        ? issuedAt * 1000
        : issuedAt
      : Date.parse(issuedAt);
  if (!Number.isFinite(timestampMs)) {
    const num = Number(issuedAt);
    if (Number.isFinite(num)) {
      const parsedNum = num < 1e11 ? num * 1000 : num;
      if (parsedNum - nowMs > clockSkewMs) return false;
      if (nowMs - parsedNum > maxAgeMs + clockSkewMs) return false;
      return true;
    }
    return false;
  }
  if (timestampMs - nowMs > clockSkewMs) return false;
  if (nowMs - timestampMs > maxAgeMs + clockSkewMs) return false;
  return true;
}

/**
 * Verifies signature over a canonical payload string.
 * Supports asymmetric signatures (e.g. Ed25519/RSA), HMAC-SHA256 secrets, or a custom verifier function.
 */
export function verifyCanonicalSignature(
  payload: string,
  signature: string,
  publicKeyOrSecret?: string | Buffer | KeyObject,
  customVerifier?: CustomVerifier,
): boolean {
  if (customVerifier) {
    try {
      return customVerifier(payload, signature);
    } catch {
      return false;
    }
  }

  if (!publicKeyOrSecret) {
    return false;
  }

  // First try asymmetric key verification (e.g., Ed25519 / SPKI / PEM / KeyObject)
  try {
    let key: any = publicKeyOrSecret;
    if (Buffer.isBuffer(publicKeyOrSecret)) {
      key = { key: publicKeyOrSecret, format: "der", type: "spki" };
    } else if (typeof publicKeyOrSecret === "string" && !publicKeyOrSecret.includes("---")) {
      key = { key: Buffer.from(publicKeyOrSecret, "base64"), format: "der", type: "spki" };
    }
    const verified = cryptoVerify(
      null,
      Buffer.from(payload, "utf8"),
      key,
      Buffer.from(signature, "base64"),
    );
    if (verified) return true;
  } catch {
    // If asymmetric verification throws, attempt HMAC check
  }

  // Fallback to HMAC-SHA256 signature verification
  try {
    const hmac = createHmac("sha256", publicKeyOrSecret as any)
      .update(payload, "utf8")
      .digest();
    const expectedSig = hmac.toString("hex");
    const expectedSigBase64 = hmac.toString("base64");
    if (signature === expectedSig || signature === expectedSigBase64) {
      return true;
    }
  } catch {
    // Ignore error
  }

  return false;
}

/**
 * Reconstructs canonical payload server-side and performs signature & request attribute verification.
 */
export function verifyCanonicalRequest(options: VerifyCanonicalRequestOptions): VerificationResult {
  const version = (options.expectedVersion ?? DEFAULT_CANONICAL_VERSION).trim();

  // 1. Version check
  if (options.expectedVersion && options.expectedVersion !== version) {
    return { valid: false, reason: "VERSION_MISMATCH", error: "Version mismatch" };
  }

  // 2. Audience check
  if (!options.audience || options.audience !== options.expectedAudience) {
    return { valid: false, reason: "AUDIENCE_MISMATCH", error: "Audience mismatch" };
  }

  // 3. Method check
  const inputMethod = options.method.trim().toUpperCase();
  if (options.expectedMethod && inputMethod !== options.expectedMethod.trim().toUpperCase()) {
    return { valid: false, reason: "METHOD_MISMATCH", error: "Method mismatch" };
  }

  // 4. Route check
  const canonicalReqRoute = canonicalizeRoute(options.route);
  if (options.expectedRoute) {
    const expectedRoute = canonicalizeRoute(options.expectedRoute);
    if (canonicalReqRoute !== expectedRoute) {
      return { valid: false, reason: "ROUTE_MISMATCH", error: "Route mismatch" };
    }
  }

  // 5. Body check
  const bodyHash = options.bodyHash ?? computeBodyHash(options.body);
  if (options.expectedBodyHash && bodyHash !== options.expectedBodyHash) {
    return { valid: false, reason: "BODY_MISMATCH", error: "Body mismatch" };
  }

  // 6. Nonce check
  if (!options.nonce || options.nonce.trim() === "") {
    return { valid: false, reason: "NONCE_INVALID", error: "Nonce invalid" };
  }

  // 7. Timestamp check
  const now = options.nowMs ?? Date.now();
  const maxAge = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const skew = options.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  if (!validateCanonicalTimestamp(options.issuedAt, now, maxAge, skew)) {
    return { valid: false, reason: "TIMESTAMP_INVALID", error: "Timestamp invalid or expired" };
  }

  // Reconstruct canonical payload
  const canonicalPayload = buildCanonicalSigningPayload({
    version,
    method: inputMethod,
    route: canonicalReqRoute,
    bodyHash,
    nonce: options.nonce,
    issuedAt: options.issuedAt,
    audience: options.audience,
  });

  // 8. Signature check
  const sigValid = verifyCanonicalSignature(
    canonicalPayload,
    options.signature,
    options.publicKeyOrSecret,
    options.verifier,
  );

  if (!sigValid) {
    return {
      valid: false,
      reason: "SIGNATURE_INVALID",
      error: "Signature verification failed",
      canonicalPayload,
    };
  }

  return {
    valid: true,
    canonicalPayload,
  };
}
