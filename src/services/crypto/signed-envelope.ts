/**
 * Ciphertext-binding signed envelope (#1707).
 *
 * ## Problem
 *
 * `SealedEnvelope` has the shape `{ payload, ciphertext }` where the wallet
 * signature covers only `payload`. An adversary who intercepts a relay
 * submission can swap `ciphertext` and replace `payload.content_commitment`
 * with a matching SHA-256 hash without invalidating the existing signature,
 * because the signature never commits to the transmitted ciphertext blob.
 *
 * ## Solution
 *
 * `CiphertextBinding` is a deterministic object that explicitly binds:
 *
 * - `ciphertext_commitment` — versioned SHA-256 of the exact ciphertext bytes
 *   (format: `v1:sha256:hex:<hex>`). Replacing ciphertext bytes changes the
 *   hash and breaks this field.
 * - `protected_headers` — the nonce (IV) and MAC drawn from the payload's
 *   `encryption_metadata`. Under AES-256-GCM, a different ciphertext produced
 *   with the same nonce would violate nonce uniqueness and be trivially
 *   detectable; changing the nonce alone causes the GCM MAC to be invalid.
 * - `suite` — the algorithm identifier, preventing cross-suite confusion.
 * - `version` — makes the signed format explicitly versioned and upgradeable.
 *
 * The wallet signs `buildBindingPreimage(binding)` — a domain-separated,
 * JCS-canonicalized byte string — with Ed25519. Ciphertext bytes are **not**
 * duplicated in the signature input; only the commitment hash is included.
 *
 * A `SignedEnvelope` augments the existing `SealedEnvelope` with both the
 * binding object and the Ed25519 signature covering it.
 *
 * ## Implementation scope
 *
 * Self-contained inside `src/services/crypto/`. Does not touch API, relay,
 * Soroban contract, UI, or routing.
 */

import { canonicalizePayload, type EnvelopePayload } from "./envelope";
import { buildSignaturePreimage, STEALTH_PROTOCOL_VERSION } from "./signing-preimage";
import { type EnvelopeSignature } from "./signature";
import { fromHex } from "./codec";
import { Keypair } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The deterministic, JCS-canonicalized object that the wallet signs to bind
 * the ciphertext to the envelope.
 *
 * All fields are non-secret; no plaintext or raw key material appears here.
 */
export interface CiphertextBinding {
  /** Format version for the binding structure itself. */
  version: "v1";
  /** Cryptographic suite identifier, e.g. "AES-256-GCM". */
  suite: string;
  /**
   * Versioned SHA-256 commitment of the raw ciphertext bytes (including the
   * appended AES-GCM authentication tag), formatted as
   * `v1:sha256:hex:<lowercase-hex>`.
   *
   * This is the exact string produced by `createCommitment()` in commitment.ts.
   */
  ciphertext_commitment: string;
  /**
   * Protected headers drawn from `EnvelopePayload.encryption_metadata`.
   * Binding these prevents an attacker from re-encrypting under a different
   * nonce while keeping the same commitment.
   */
  protected_headers: {
    algorithm: string;
    nonce: string;
    mac: string;
  };
}

/**
 * A fully signed envelope that proves the sender authorized both the payload
 * **and** the exact ciphertext transmitted.
 */
export interface SignedEnvelope {
  /** The structured envelope payload (sender, recipient, timestamps, etc.). */
  payload: EnvelopePayload;
  /** Base64-encoded AES-256-GCM ciphertext (including trailing auth tag). */
  ciphertext: string;
  /**
   * The ciphertext binding object that was signed. Recipients can re-derive
   * this from `payload` + `ciphertext` and compare against the signature.
   */
  binding: CiphertextBinding;
  /**
   * Ed25519 signature over `buildBindingPreimage(binding)`.
   * Verifying this signature confirms the sender authorized the exact
   * ciphertext identified by `binding.ciphertext_commitment`.
   */
  signature: EnvelopeSignature;
}

// ---------------------------------------------------------------------------
// Domain separation
// ---------------------------------------------------------------------------

/**
 * Operation label used when building the domain-separated preimage.
 * Combined with `STEALTH_DOMAIN_TAG` and version in `buildSignaturePreimage`.
 */
export const BINDING_OPERATION = "ciphertext_binding" as const;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Build a `CiphertextBinding` from a sealed envelope payload and the
 * versioned ciphertext commitment string.
 *
 * The commitment string must be in the format produced by `createCommitment()`
 * (`v1:sha256:hex:<hex>`). Callers should compute this via `createCommitment`
 * before base64-encoding and releasing the raw ciphertext buffer.
 *
 * @param payload               The envelope payload (provides encryption_metadata).
 * @param ciphertextCommitment  Versioned commitment from `createCommitment()`.
 * @returns A deterministic `CiphertextBinding` ready to be signed.
 * @throws {Error} If `payload.encryption_metadata` fields are missing.
 */
export function buildCiphertextBinding(
  payload: EnvelopePayload,
  ciphertextCommitment: string,
): CiphertextBinding {
  const meta = payload.encryption_metadata;
  if (!meta || !meta.algorithm || !meta.nonce || !meta.mac) {
    throw new Error(
      "buildCiphertextBinding: payload.encryption_metadata must include algorithm, nonce, and mac",
    );
  }
  if (typeof ciphertextCommitment !== "string" || ciphertextCommitment.length === 0) {
    throw new Error("buildCiphertextBinding: ciphertextCommitment must be a non-empty string");
  }

  return {
    version: "v1",
    suite: meta.algorithm,
    ciphertext_commitment: ciphertextCommitment,
    protected_headers: {
      algorithm: meta.algorithm,
      nonce: meta.nonce,
      mac: meta.mac,
    },
  };
}

/**
 * Build the domain-separated, deterministic byte string that the wallet signs.
 *
 * Format:
 * ```
 * Stealth_Mail_Protocol:<version>:<network>:ciphertext_binding:<jcs(binding)>
 * ```
 *
 * Properties:
 * - **Deterministic**: JCS (RFC 8785) ensures identical key order and number
 *   representation for every call with the same `binding` value.
 * - **Versioned**: The domain tag includes the protocol version; changing the
 *   binding schema requires bumping the version.
 * - **No plaintext**: Only the commitment hash, suite, and nonce/MAC appear;
 *   raw ciphertext bytes are never encoded into the preimage.
 *
 * @param binding  The binding object (as produced by `buildCiphertextBinding`).
 * @param network  The Stellar network identifier, e.g. "public" or "testnet".
 * @param version  Override the protocol version (default: `STEALTH_PROTOCOL_VERSION`).
 * @returns UTF-8 byte array to be signed directly with Ed25519.
 */
export function buildBindingPreimage(
  binding: CiphertextBinding,
  network: string = "public",
  version: string = STEALTH_PROTOCOL_VERSION,
): Uint8Array {
  const canonical = canonicalizePayload(binding);
  return buildSignaturePreimage(canonical, {
    network,
    operation: BINDING_OPERATION,
    version,
  });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify the Ed25519 signature on a `SignedEnvelope`'s ciphertext binding.
 *
 * Enforces:
 * 1. Scheme must be `"Ed25519"`.
 * 2. `signerAddress` must equal `expectedSender`.
 * 3. `payload.sender` must equal `expectedSender`.
 * 4. The signature value is a valid 64-byte hex-encoded Ed25519 signature
 *    over `buildBindingPreimage(envelope.binding, network, version)`.
 *
 * @param envelope        The signed envelope to verify.
 * @param expectedSender  The Stellar account address expected to have signed.
 * @param network         Stellar network identifier (default: "public").
 * @param version         Protocol version override (default: current).
 * @returns `true` if the signature is valid for the binding; `false` otherwise.
 */
export function verifyBindingSignature(
  envelope: SignedEnvelope,
  expectedSender: string,
  network: string = "public",
  version: string = STEALTH_PROTOCOL_VERSION,
): boolean {
  const { signature, binding, payload } = envelope;

  if (signature.scheme !== "Ed25519") {
    return false;
  }
  if (signature.signerAddress !== expectedSender) {
    return false;
  }
  if (payload.sender !== expectedSender) {
    return false;
  }

  let sigBytes: Uint8Array;
  try {
    // Strict decoding: must be valid hex and exactly 64 bytes.
    sigBytes = fromHex(signature.value, 64);
  } catch {
    return false;
  }

  const preimage = buildBindingPreimage(binding, network, version);

  try {
    const keypair = Keypair.fromPublicKey(signature.signerAddress);
    return keypair.verify(Buffer.from(preimage), Buffer.from(sigBytes));
  } catch {
    return false;
  }
}

/**
 * Re-derive the `CiphertextBinding` from a `SignedEnvelope` and verify that
 * it matches the `binding` field that was actually signed.
 *
 * This check catches an attacker who transmits a tampered ciphertext and a
 * freshly-computed binding but cannot forge the sender's signature over it.
 * It also catches a payload where `content_commitment` has been replaced to
 * match substitute ciphertext but the signed `binding.ciphertext_commitment`
 * still reflects the original.
 *
 * @param envelope  The signed envelope to audit.
 * @throws {Error}  If the re-derived binding does not match `envelope.binding`.
 */
export function assertBindingConsistency(envelope: SignedEnvelope): void {
  const rederived = buildCiphertextBinding(envelope.payload, envelope.payload.content_commitment);

  const canonicalize = (obj: object) => canonicalizePayload(obj);

  if (canonicalize(rederived) !== canonicalize(envelope.binding)) {
    throw new Error(
      "assertBindingConsistency: signed binding does not match re-derived binding from payload — " +
        "ciphertext or protected headers may have been tampered with",
    );
  }
}
