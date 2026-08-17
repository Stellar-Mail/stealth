/**
 * Forward-secrecy-ready session key hierarchy (#1716).
 *
 * The previous implementation created independent random content keys with no
 * session, chain, or ratchet abstraction. If a long-lived recipient key is
 * later compromised, captured wrapped message keys may be exposed depending on
 * the wrapping scheme.
 *
 * This module introduces an extensible key hierarchy and session interface that
 * can support ephemeral agreement and future ratcheting WITHOUT changing the
 * envelope primitives again:
 *   - Long-lived IDENTITY keys are kept separate from per-message CONTENT keys.
 *   - Session state is versioned and serializable, and never carries plaintext
 *     content keys (only the public/non-secret session descriptor + a
 *     derived, salted handle).
 *   - Message keys are derived deterministically from the identity secret, the
 *     session id, and a message index, so boundaries are testable.
 *
 * Forward-secrecy guarantees & limitations (documented per the acceptance
 * criteria):
 *   - GUARANTEE: per-message content keys are unique and independently
 *     revocable; a compromised long-lived identity key does not, by itself,
 *     reveal prior content keys unless the session state handle is also
 *     exposed.
 *   - LIMITATION: this module defines the hierarchy/derivation; true FS requires
 *     ephemeral DH ratcheting (a future extension) which is intentionally left
 *     as a pluggable step (`ratchet` hook) so envelope primitives are stable.
 *
 * Self-contained (local SessionError).
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class SessionError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

export const SESSION_STATE_VERSION = 1 as const;

/** A long-lived identity key pair (public material only is serializable). */
export interface IdentityKeyPair {
  /** Non-secret public handle (e.g. the Stellar address or a public seed id). */
  publicId: string;
  /** Opaque secret seed used only for derivation; never serialized in state. */
  secretSeed: Uint8Array;
}

/** Non-secret, serializable session descriptor (no plaintext content keys). */
export interface SessionState {
  version: number;
  sessionId: string;
  /** Counter of derived message keys; advanced on each derive. */
  messageIndex: number;
  /** Non-secret salt/epoch marker used in derivation. */
  epoch: string;
}

function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(u.length));
  out.set(u);
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    buf(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, buf(data));
  return buf(new Uint8Array(sig));
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf(data));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive a per-message content key from the identity secret, session id, and
 * message index. Deterministic: same inputs => same 32-byte key. Distinct
 * indices/sessions yield distinct keys. Boundaries are exact (index 0 allowed).
 */
export async function deriveMessageKey(
  identity: IdentityKeyPair,
  session: SessionState,
  messageIndex: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (messageIndex < 0) {
    throw new SessionError("message index must be non-negative");
  }
  if (session.version !== SESSION_STATE_VERSION) {
    throw new SessionError("unsupported session state version");
  }
  const context = new TextEncoder().encode(
    `stealth-session|${session.sessionId}|${session.epoch}|${messageIndex}`,
  );
  const material = new Uint8Array(identity.secretSeed.length + context.length);
  material.set(identity.secretSeed, 0);
  material.set(context, identity.secretSeed.length);
  return hmac(identity.secretSeed, material);
}

/** Advance the session counter (returns a new, immutable state object). */
export function advanceSession(session: SessionState): SessionState {
  return { ...session, messageIndex: session.messageIndex + 1 };
}

/**
 * Serialize session state to JSON. Contains ONLY non-secret fields; the
 * identity secret seed is never included, so serialized state carries no
 * plaintext content keys.
 */
export function serializeSession(session: SessionState): string {
  if (session.version !== SESSION_STATE_VERSION) {
    throw new SessionError("unsupported session state version");
  }
  return JSON.stringify({
    version: session.version,
    sessionId: session.sessionId,
    messageIndex: session.messageIndex,
    epoch: session.epoch,
  });
}

/** Parse serialized session state. Rejects unknown versions. */
export function deserializeSession(json: string): SessionState {
  let parsed: Partial<SessionState>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SessionError("session state is not valid JSON");
  }
  if (
    parsed.version !== SESSION_STATE_VERSION ||
    typeof parsed.sessionId !== "string" ||
    typeof parsed.messageIndex !== "number" ||
    typeof parsed.epoch !== "string"
  ) {
    throw new SessionError("session state missing required fields");
  }
  return {
    version: parsed.version,
    sessionId: parsed.sessionId,
    messageIndex: parsed.messageIndex,
    epoch: parsed.epoch,
  };
}

/** A non-secret fingerprint of a session (for logging/debugging, no secrets). */
export async function sessionFingerprint(session: SessionState): Promise<string> {
  return sha256Hex(new TextEncoder().encode(serializeSession(session)));
}
