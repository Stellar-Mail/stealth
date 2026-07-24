/**
 * Relay request authentication and replay protection.
 *
 * Reference verifier for protocol/docs/protocol/relay-auth-replay.md. It
 * validates a relay request (envelope payload + the four mandatory anti-replay
 * fields) in a strict, fail-closed order: signature -> audience -> freshness ->
 * nonce uniqueness -> idempotency.
 *
 * The module is pure and deterministic: time and the nonce store are injected so
 * it can be driven by conformance vectors without wall-clock or global state.
 */

import { canonicalizePayload } from "./envelope";

/** Server-side constants (see spec §6). */
export const MAX_REPLAY_WINDOW_SECONDS = 300;
export const CLOCK_SKEW_TOLERANCE_SECONDS = 30;

/** Stable error codes (spec §8). */
export type RelayAuthErrorCode =
  | "INVALID_SIGNATURE"
  | "AUDIENCE_MISMATCH"
  | "STALE_REQUEST"
  | "FUTURE_REQUEST"
  | "REPLAY_DETECTED"
  | "INVALID_REQUEST";

export class RelayAuthError extends Error {
  readonly code: RelayAuthErrorCode;
  readonly httpStatus: number;
  constructor(code: RelayAuthErrorCode, message: string) {
    super(message);
    this.name = "RelayAuthError";
    this.code = code;
    this.httpStatus = code === "INVALID_SIGNATURE" ? 401 : code === "AUDIENCE_MISMATCH" ? 403 : 409;
  }
}

/** A relay request: the envelope payload plus the four anti-replay fields. */
export interface RelayRequestPayload {
  version: "v1";
  sender: string;
  recipient: string;
  timestamp: string;
  encryption_metadata: { algorithm: string; nonce: string; mac: string };
  content_commitment: string;
  attachments: unknown[];
  request_nonce: string;
  audience: string;
  idempotency_key: string;
  replay_window_seconds: number;
}

export interface RelayRequest {
  payload: RelayRequestPayload;
  /** Hex-encoded Ed25519 signature over jcs(payload). */
  signature: { scheme: "Ed25519"; value: string };
}

/** Minimal verifier injected by the caller (e.g. ed25519 via noble/tweetnacl). */
export type SignatureVerifier = (params: {
  publicKey: string;
  message: string;
  signature: string;
}) => boolean;

export interface RelayAuthConfig {
  /** The authority id this relay answers to (spec §5.2). */
  audience: string;
  /** Verifies an Ed25519 signature over the canonical payload. */
  verify: SignatureVerifier;
  /** Resolves the sender's Ed25519 public key (Stellar G-address). */
  resolvePublicKey: (sender: string) => string | null;
  /** Returns true if the nonce was already recorded. */
  isNonceSeen: (nonce: string) => boolean;
  /** Records a nonce as seen (called after successful validation). */
  markNonceSeen: (nonce: string) => void;
  /** Returns the stored result for an idempotency key, if any. */
  getIdempotencyResult: (key: string) => unknown | null;
  /** Stores the result against an idempotency key. */
  storeIdempotencyResult: (key: string, result: unknown) => void;
  /** Injectable clock (seconds since epoch) for deterministic tests. */
  nowSeconds: () => number;
}

function parseTimestampSeconds(ts: string): number {
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) {
    throw new RelayAuthError("INVALID_REQUEST", `Invalid timestamp: ${ts}`);
  }
  return Math.floor(ms / 1000);
}

/**
 * Validate a relay request.
 *
 * Returns `{ ok: true, idempotencyReplayed: boolean, result?: unknown }`. When
 * the idempotency key was already completed, `idempotencyReplayed` is true and
 * `result` carries the original stored value (spec §5.5). On any failure throws
 * `RelayAuthError` with a stable code.
 */
export function verifyRelayRequest(
  request: RelayRequest,
  config: RelayAuthConfig,
): { ok: true; idempotencyReplayed: boolean; result?: unknown } {
  const { payload, signature } = request;

  // --- Mandatory fields (spec §3) ---
  if (
    typeof payload.request_nonce !== "string" ||
    typeof payload.audience !== "string" ||
    typeof payload.idempotency_key !== "string" ||
    typeof payload.replay_window_seconds !== "number"
  ) {
    throw new RelayAuthError("INVALID_REQUEST", "Missing mandatory anti-replay field(s)");
  }
  if (payload.request_nonce.length < 16) {
    throw new RelayAuthError("INVALID_REQUEST", "request_nonce too short");
  }

  // --- 1. Signature (spec §5.1) ---
  const publicKey = config.resolvePublicKey(payload.sender);
  if (!publicKey) {
    throw new RelayAuthError("INVALID_SIGNATURE", "Unknown sender public key");
  }
  const canonical = canonicalizePayload(payload);
  const sigOk = config.verify({
    publicKey,
    message: canonical,
    signature: signature.value,
  });
  if (!sigOk) {
    throw new RelayAuthError("INVALID_SIGNATURE", "Signature verification failed");
  }

  // --- 2. Audience (spec §5.2) ---
  if (payload.audience !== config.audience) {
    throw new RelayAuthError(
      "AUDIENCE_MISMATCH",
      `audience ${payload.audience} != ${config.audience}`,
    );
  }

  // --- 3. Freshness (spec §5.3, §6) ---
  const now = config.nowSeconds();
  const ts = parseTimestampSeconds(payload.timestamp);
  const delta = now - ts;
  const window = Math.min(payload.replay_window_seconds, MAX_REPLAY_WINDOW_SECONDS);
  if (delta > window) {
    throw new RelayAuthError("STALE_REQUEST", "Request older than replay window");
  }
  if (delta < -CLOCK_SKEW_TOLERANCE_SECONDS) {
    throw new RelayAuthError("FUTURE_REQUEST", "Timestamp too far in the future");
  }

  // --- 4. Nonce uniqueness (spec §5.4) ---
  if (config.isNonceSeen(payload.request_nonce)) {
    throw new RelayAuthError("REPLAY_DETECTED", "request_nonce already seen");
  }

  // --- 5. Idempotency (spec §5.5) ---
  const prior = config.getIdempotencyResult(payload.idempotency_key);
  if (prior !== null && prior !== undefined) {
    return { ok: true, idempotencyReplayed: true, result: prior };
  }

  // Record presence so a subsequent identical request is idempotent.
  config.markNonceSeen(payload.request_nonce);
  const result = { accepted: true, messageId: payload.content_commitment };
  config.storeIdempotencyResult(payload.idempotency_key, result);
  return { ok: true, idempotencyReplayed: false, result };
}
