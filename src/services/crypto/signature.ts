import { Keypair } from "@stellar/stellar-sdk";
import { canonicalizePayload, type EnvelopePayload } from "./envelope";
import { fromHex } from "./codec";

/** Domain separation prefix for Ed25519 payload signatures. */
export const ENVELOPE_SIGNATURE_DOMAIN = "stealth-mail-envelope-v1:";

export interface EnvelopeSignature {
  scheme: "Ed25519";
  signerAddress: string;
  value: string;
}

/**
 * Verify that the envelope payload was authorized by the expected sender.
 *
 * Enforces:
 * 1. Ed25519 scheme
 * 2. Strict hex decoding of the 64-byte signature
 * 3. Signer-address matching against the expected sender
 * 4. Domain-separated canonical payload signature
 *
 * @param payload The canonical envelope payload to verify.
 * @param signature The inbound signature claiming to authorize the payload.
 * @param expectedSender The expected Stellar account address of the sender.
 * @returns true if the signature is perfectly valid and matches the expected sender.
 */
export function verifyEnvelopeSignature(
  payload: EnvelopePayload,
  signature: EnvelopeSignature,
  expectedSender: string,
): boolean {
  if (signature.scheme !== "Ed25519") {
    return false;
  }

  // Verification does not trust signerAddress metadata alone,
  // we must match it to the expected sender.
  if (signature.signerAddress !== expectedSender) {
    return false;
  }

  // The sender in the payload itself must also match the expected sender.
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

  const canonical = canonicalizePayload(payload);
  const dataToSign = new TextEncoder().encode(ENVELOPE_SIGNATURE_DOMAIN + canonical);

  try {
    const keypair = Keypair.fromPublicKey(signature.signerAddress);
    return keypair.verify(Buffer.from(dataToSign), Buffer.from(sigBytes));
  } catch {
    // Fails if public key is malformed or verify returns false
    return false;
  }
}
