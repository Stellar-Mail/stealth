import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import {
  verifyEnvelopeSignature,
  ENVELOPE_SIGNATURE_DOMAIN,
  type EnvelopeSignature,
} from "@/services/crypto/signature";
import { canonicalizePayload, type EnvelopePayload } from "@/services/crypto/envelope";
import { toHex } from "@/services/crypto/codec";

function generateTestPayload(sender: string, recipient: string): EnvelopePayload {
  return {
    version: "v1",
    sender,
    recipient,
    timestamp: "2024-01-01T00:00:00.000Z",
    encryption_metadata: {
      algorithm: "AES-256-GCM",
      nonce: "0102030405060708090a0b0c",
      mac: "0102030405060708090a0b0c0d0e0f10",
    },
    content_commitment: "abcdef",
    attachments: [],
  };
}

describe("verifyEnvelopeSignature", () => {
  it("verifies a valid Ed25519 signature", () => {
    const senderKp = Keypair.random();
    const recipientKp = Keypair.random();
    const payload = generateTestPayload(senderKp.publicKey(), recipientKp.publicKey());

    const canonical = canonicalizePayload(payload);
    const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
    const sigBytes = senderKp.sign(dataToSign);

    const signature: EnvelopeSignature = {
      scheme: "Ed25519",
      signerAddress: senderKp.publicKey(),
      value: toHex(new Uint8Array(sigBytes)),
    };

    expect(verifyEnvelopeSignature(payload, signature, senderKp.publicKey())).toBe(true);
  });

  it("fails if the signer does not match the expected sender", () => {
    const senderKp = Keypair.random();
    const wrongKp = Keypair.random();
    const payload = generateTestPayload(senderKp.publicKey(), Keypair.random().publicKey());

    // Wrong person signs the correct payload
    const canonical = canonicalizePayload(payload);
    const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
    const sigBytes = wrongKp.sign(dataToSign);

    const signature: EnvelopeSignature = {
      scheme: "Ed25519",
      signerAddress: wrongKp.publicKey(),
      value: toHex(new Uint8Array(sigBytes)),
    };

    // Fails because the signature was signed by wrongKp but we expect senderKp
    expect(verifyEnvelopeSignature(payload, signature, senderKp.publicKey())).toBe(false);
  });

  it("fails if the payload sender field does not match the expected sender", () => {
    const senderKp = Keypair.random();
    const wrongKp = Keypair.random();
    // Payload claims the sender is `wrongKp`
    const payload = generateTestPayload(wrongKp.publicKey(), Keypair.random().publicKey());

    const canonical = canonicalizePayload(payload);
    const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
    const sigBytes = senderKp.sign(dataToSign);

    const signature: EnvelopeSignature = {
      scheme: "Ed25519",
      signerAddress: senderKp.publicKey(),
      value: toHex(new Uint8Array(sigBytes)),
    };

    // Even though senderKp signed it, the payload says it's from wrongKp, which doesn't match expectedSender
    expect(verifyEnvelopeSignature(payload, signature, senderKp.publicKey())).toBe(false);
  });

  it("fails if verification does not trust signerAddress metadata alone", () => {
    const expectedSenderKp = Keypair.random();
    const attackerKp = Keypair.random();
    const payload = generateTestPayload(expectedSenderKp.publicKey(), Keypair.random().publicKey());

    const canonical = canonicalizePayload(payload);
    const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
    // Attacker signs the payload
    const sigBytes = attackerKp.sign(dataToSign);

    const signature: EnvelopeSignature = {
      scheme: "Ed25519",
      // Attacker lies and says expectedSenderKp signed it
      signerAddress: expectedSenderKp.publicKey(),
      value: toHex(new Uint8Array(sigBytes)),
    };

    // Signature won't verify because the actual bytes were signed by attackerKp
    expect(verifyEnvelopeSignature(payload, signature, expectedSenderKp.publicKey())).toBe(false);
  });

  it("fails if the signature is malformed", () => {
    const senderKp = Keypair.random();
    const payload = generateTestPayload(senderKp.publicKey(), Keypair.random().publicKey());

    const signature: EnvelopeSignature = {
      scheme: "Ed25519",
      signerAddress: senderKp.publicKey(),
      value: "invalid-hex", // Not hex
    };
    expect(verifyEnvelopeSignature(payload, signature, senderKp.publicKey())).toBe(false);

    const signature2: EnvelopeSignature = {
      scheme: "Ed25519",
      signerAddress: senderKp.publicKey(),
      value: "aabbcc", // Not 64 bytes
    };
    expect(verifyEnvelopeSignature(payload, signature2, senderKp.publicKey())).toBe(false);
  });

  it("fails if the payload has been changed", () => {
    const senderKp = Keypair.random();
    const payload = generateTestPayload(senderKp.publicKey(), Keypair.random().publicKey());

    const canonical = canonicalizePayload(payload);
    const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
    const sigBytes = senderKp.sign(dataToSign);

    const signature: EnvelopeSignature = {
      scheme: "Ed25519",
      signerAddress: senderKp.publicKey(),
      value: toHex(new Uint8Array(sigBytes)),
    };

    // Change payload after signing
    payload.content_commitment = "different";

    expect(verifyEnvelopeSignature(payload, signature, senderKp.publicKey())).toBe(false);
  });

  it("fails if scheme is not Ed25519", () => {
    const senderKp = Keypair.random();
    const payload = generateTestPayload(senderKp.publicKey(), Keypair.random().publicKey());

    const canonical = canonicalizePayload(payload);
    const dataToSign = Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical);
    const sigBytes = senderKp.sign(dataToSign);

    const signature = {
      scheme: "RSA",
      signerAddress: senderKp.publicKey(),
      value: toHex(new Uint8Array(sigBytes)),
    } as any; // Cast to bypass type check for testing

    expect(verifyEnvelopeSignature(payload, signature, senderKp.publicKey())).toBe(false);
  });
});
