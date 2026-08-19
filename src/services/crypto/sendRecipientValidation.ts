/**
 * Send-path recipient key domain rules (BETA-046 / #1953).
 *
 * The live compose path must only ever seal an envelope against identity
 * material that is current, valid, and usable by this client. This module turns
 * raw key-directory output into stable, non-secret rejection codes so the
 * compose pipeline can surface recoverable errors without leaking key or
 * identity material.
 *
 * Rules enforced before any encryption or signing:
 * - The key must be bound to the recipient being addressed (no cross-account /
 *   wrong-network identity confusion).
 * - The key must not be revoked, expired, or not-yet-valid.
 * - The key material must import as a P-256 ECDH SPKI public key, the curve
 *   used by the envelope key-wrapping suite. Anything else (ed25519 signing
 *   keys, other curves, malformed bytes, or a directory owner that does not
 *   match the resolved recipient) is treated as unsupported or wrong-network
 *   material and rejected before submission.
 */
import { ResolverError } from "./key-resolver";
import { importRecipientPublicKey } from "./key-wrap";
import { toBase64 } from "./codec";
import type { ResolvedKey } from "./key-resolver";

/** Stable, non-secret rejection codes for recipient identity material. */
export type SendRecipientRejection =
  | "revoked"
  | "expired"
  | "not_yet_valid"
  | "unsupported_algorithm"
  | "wrong_network"
  | "unresolved";

/** Key material that passed every domain rule and is safe to seal against. */
export interface RecipientKeyMaterial {
  /** Stellar G-address the key is bound to (directory owner / resolved account). */
  account: string;
  /** Base64-encoded SPKI P-256 ECDH public key for envelope key wrapping. */
  publicKeySpkiBase64: string;
  /** Stable key identifier recorded in the envelope encryption metadata. */
  keyId: string;
}

/** Minimal non-secret error carrying a stable rejection code (no key leakage). */
export class RecipientKeyRejectedError extends Error {
  readonly code: SendRecipientRejection;
  readonly recipient: string;
  constructor(recipient: string, code: SendRecipientRejection, message: string) {
    super(message);
    this.name = "RecipientKeyRejectedError";
    this.recipient = recipient;
    this.code = code;
  }
}

function reject(recipient: string, code: SendRecipientRejection, message: string): never {
  throw new RecipientKeyRejectedError(recipient, code, message);
}

/**
 * Map a resolver failure (typically {@link ResolverError}) to a stable
 * rejection code. The messages are the non-secret values produced by
 * `validateResolvedKey`, so matching on them is safe and stable.
 */
export function classifyResolverFailure(
  recipient: string,
  error: unknown,
): RecipientKeyRejectedError {
  if (error instanceof RecipientKeyRejectedError) {
    return error;
  }
  if (error instanceof ResolverError) {
    const message = error.message;
    if (message.includes("revoked")) {
      return new RecipientKeyRejectedError(recipient, "revoked", message);
    }
    if (message.includes("not yet valid")) {
      return new RecipientKeyRejectedError(recipient, "not_yet_valid", message);
    }
    if (message.includes("expired")) {
      return new RecipientKeyRejectedError(recipient, "expired", message);
    }
    if (message.includes("not bound") || message.includes("recipient")) {
      return new RecipientKeyRejectedError(recipient, "wrong_network", message);
    }
    if (message.includes("no public key material")) {
      return new RecipientKeyRejectedError(recipient, "unresolved", message);
    }
    return new RecipientKeyRejectedError(recipient, "unresolved", message);
  }
  if (error instanceof Error && /directory|not found/i.test(error.message)) {
    return new RecipientKeyRejectedError(recipient, "unresolved", error.message);
  }
  return new RecipientKeyRejectedError(
    recipient,
    "unresolved",
    "recipient key could not be resolved",
  );
}

/**
 * Validate a resolved key and convert it into envelope-ready key material.
 * Throws {@link RecipientKeyRejectedError} with a stable code on any failure.
 */
export async function recipientKeyToMaterial(
  resolved: ResolvedKey,
  recipient: string,
): Promise<RecipientKeyMaterial> {
  // Re-assert binding and lifecycle state at this boundary (defense in depth).
  if (resolved.recipient !== recipient) {
    reject(recipient, "wrong_network", "resolved key is not bound to the requested recipient");
  }
  if (resolved.revoked) {
    reject(recipient, "revoked", "resolved key has been revoked");
  }
  if (!resolved.publicKey || resolved.publicKey.length === 0) {
    reject(recipient, "unresolved", "resolved key has no public key material");
  }

  const publicKeySpkiBase64 = toBase64(resolved.publicKey);

  // The key must actually import as the envelope wrapping curve. A directory
  // may publish signing keys, rotated/retired keys, or keys from another
  // network/curve; none of those are acceptable on the send path.
  try {
    await importRecipientPublicKey(publicKeySpkiBase64);
  } catch {
    reject(
      recipient,
      "unsupported_algorithm",
      "resolved key is not a supported P-256 encryption key",
    );
  }

  return {
    account: recipient,
    publicKeySpkiBase64,
    keyId: resolved.keyId,
  };
}
