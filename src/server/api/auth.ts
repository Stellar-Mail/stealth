/**
 * Signed-request authentication for the Stealth API.
 *
 * A caller proves control of a Stellar account by signing a canonical
 * request payload with the corresponding Ed25519 private key. The server
 * verifies the signature against the claimed public key (G-address) without
 * any prior challenge round-trip.
 *
 * ## Canonical payload
 *
 *   stealth-auth:v1:<METHOD>:<PATH>:<TIMESTAMP>:<NONCE>
 *
 * Field descriptions
 *   - "stealth-auth:v1"  – fixed domain prefix; prevents cross-protocol reuse
 *   - METHOD             – uppercase HTTP method (GET, POST, …)
 *   - PATH               – URL pathname only, no query string or origin
 *   - TIMESTAMP          – ISO 8601 UTC timestamp (caller's clock)
 *   - NONCE              – caller-chosen opaque string, ≥ 8 chars, ≤ 128 chars
 *
 * ## Request headers
 *
 *   x-stealth-address    – Stellar G-address (claimed public key)
 *   x-stealth-timestamp  – ISO 8601 timestamp matching the payload
 *   x-stealth-nonce      – nonce matching the payload
 *   x-stealth-signature  – lowercase hex Ed25519 signature over the
 *                          UTF-8 bytes of the canonical payload
 *
 * ## Security properties
 *
 *   Expiration    – timestamps outside a ±CLOCK_SKEW_MS window are rejected.
 *   Replay        – each (address, nonce) pair is recorded for the signature
 *                   lifetime; reuse within that window is rejected.
 *   Domain sep    – the "stealth-auth:v1" prefix prevents reuse of signatures
 *                   produced for other purposes (e.g. message envelopes).
 *   No raw data   – the nonce key stored for replay protection is a SHA-256
 *                   digest of "address:nonce" so neither raw value is persisted.
 */

import { createHash } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";

import { stellarAddressSchema } from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTH_DOMAIN_PREFIX = "stealth-auth:v1";

/** Headers the caller must supply. */
export const AUTH_HEADERS = {
  address: "x-stealth-address",
  timestamp: "x-stealth-timestamp",
  nonce: "x-stealth-nonce",
  signature: "x-stealth-signature",
} as const;

/** Maximum clock drift tolerated in milliseconds (5 minutes). */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Window used to persist nonce records for replay protection (seconds). */
export const NONCE_WINDOW_SECONDS = Math.ceil((CLOCK_SKEW_MS * 2) / 1000);

/** Minimum / maximum allowed nonce length (characters). */
const NONCE_MIN_LEN = 8;
const NONCE_MAX_LEN = 128;

// ---------------------------------------------------------------------------
// Canonical payload
// ---------------------------------------------------------------------------

/**
 * Builds the canonical payload that the caller must sign.
 * Consumers (client-side code and tests) should call this to reproduce
 * the exact string that the server will verify.
 */
export function buildCanonicalPayload(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
): string {
  return `${AUTH_DOMAIN_PREFIX}:${method.toUpperCase()}:${path}:${timestamp}:${nonce}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function deriveNonceKey(address: string, nonce: string): string {
  return createHash("sha256")
    .update(`${address}:${nonce}`)
    .digest("hex");
}

function header(request: Request, name: string): string | null {
  return request.headers.get(name);
}

function requireHeader(request: Request, name: string): string {
  const value = header(request, name);
  if (!value) {
    throw new ApiError(401, "unauthorized", `Missing required header: ${name}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

export interface VerifiedActor {
  /** The verified Stellar G-address. Safe to use as a principal. */
  address: string;
}

/**
 * Verifies a signed request and returns the authenticated principal.
 *
 * Performs, in order:
 *   1. Header presence and format validation
 *   2. Timestamp expiration check
 *   3. Ed25519 signature verification
 *   4. Replay-nonce check (requires repository)
 *
 * Throws ApiError(401) for any verification failure.
 */
export async function verifySignedRequest(
  request: Request,
  repository: ApiRepository,
  now = new Date(),
): Promise<VerifiedActor> {
  // 1. Read and validate headers
  const rawAddress = requireHeader(request, AUTH_HEADERS.address);
  const rawTimestamp = requireHeader(request, AUTH_HEADERS.timestamp);
  const nonce = requireHeader(request, AUTH_HEADERS.nonce);
  const rawSignature = requireHeader(request, AUTH_HEADERS.signature);

  const addressResult = stellarAddressSchema.safeParse(rawAddress);
  if (!addressResult.success) {
    throw new ApiError(401, "unauthorized", `${AUTH_HEADERS.address} must be a valid Stellar G-address`);
  }
  const address = addressResult.data;

  if (nonce.length < NONCE_MIN_LEN || nonce.length > NONCE_MAX_LEN) {
    throw new ApiError(
      401,
      "unauthorized",
      `${AUTH_HEADERS.nonce} must be between ${NONCE_MIN_LEN} and ${NONCE_MAX_LEN} characters`,
    );
  }

  if (!/^[a-f0-9]{128}$/.test(rawSignature)) {
    throw new ApiError(
      401,
      "unauthorized",
      `${AUTH_HEADERS.signature} must be a 128-character lowercase hex string`,
    );
  }

  // 2. Expiration check
  const timestamp = new Date(rawTimestamp);
  if (isNaN(timestamp.getTime())) {
    throw new ApiError(401, "unauthorized", `${AUTH_HEADERS.timestamp} is not a valid ISO 8601 timestamp`);
  }

  const drift = Math.abs(now.getTime() - timestamp.getTime());
  if (drift > CLOCK_SKEW_MS) {
    throw new ApiError(401, "unauthorized", "Request timestamp is outside the acceptable window");
  }

  // 3. Signature verification
  const url = new URL(request.url);
  const canonical = buildCanonicalPayload(request.method, url.pathname, rawTimestamp, nonce);
  const payload = Buffer.from(canonical, "utf8");
  const signature = Buffer.from(rawSignature, "hex");

  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(address);
  } catch {
    throw new ApiError(401, "unauthorized", "Could not load public key from address");
  }

  let valid: boolean;
  try {
    valid = keypair.verify(payload, signature);
  } catch {
    valid = false;
  }

  if (!valid) {
    throw new ApiError(401, "unauthorized", "Signature verification failed");
  }

  // 4. Replay protection — store nonce digest; reject if already seen
  const nonceKey = `auth:nonce:${deriveNonceKey(address, nonce)}`;
  const existing = await repository.getIdempotencyRecord(nonceKey);
  if (existing) {
    throw new ApiError(401, "unauthorized", "Nonce has already been used");
  }

  await repository.setIdempotencyRecord(nonceKey, {
    status: 200,
    body: null,
    createdAt: now.toISOString(),
  });

  return { address };
}

// ---------------------------------------------------------------------------
// Route-level helpers
// ---------------------------------------------------------------------------

/**
 * Require a fully verified actor. Throws ApiError(401) if any
 * verification step fails.
 *
 * Pass `repository` so replay protection can be enforced.
 */
export async function requireVerifiedActor(
  request: Request,
  repository: ApiRepository,
  now?: Date,
): Promise<string> {
  const actor = await verifySignedRequest(request, repository, now);
  return actor.address;
}

/**
 * Require that the verified actor matches a specific expected address.
 * Throws ApiError(403) if the actor does not match.
 */
export async function requireVerifiedActorMatches(
  request: Request,
  repository: ApiRepository,
  expectedAddress: string,
  now?: Date,
): Promise<string> {
  const address = await requireVerifiedActor(request, repository, now);
  if (address !== expectedAddress) {
    throw new ApiError(403, "forbidden", "The authenticated actor cannot modify this resource");
  }
  return address;
}
