/**
 * Tests for signed-envelope.ts (#1707).
 *
 * Acceptance criteria:
 * - Replacing ciphertext invalidates either commitment verification or
 *   signature verification.
 * - The signed preimage is versioned and deterministic.
 * - Ciphertext bytes are not duplicated unnecessarily in the signature input.
 * - Tests cover substitution and commitment mismatch.
 */

import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildCiphertextBinding,
  buildBindingPreimage,
  verifyBindingSignature,
  assertBindingConsistency,
  BINDING_OPERATION,
  type CiphertextBinding,
  type SignedEnvelope,
} from "../../../src/services/crypto/signed-envelope";
import { verifyCommitment, createCommitment } from "../../../src/services/crypto/commitment";
import {
  STEALTH_DOMAIN_TAG,
  STEALTH_PROTOCOL_VERSION,
} from "../../../src/services/crypto/signing-preimage";
import { type EnvelopePayload } from "../../../src/services/crypto/envelope";
import { type EnvelopeSignature } from "../../../src/services/crypto/signature";
import { toHex } from "../../../src/services/crypto/codec";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fake but structurally valid 64-byte hex signature (128 hex chars of zeros). */
const ZERO_SIG_HEX = "0".repeat(128);

function makePayload(overrides: Partial<EnvelopePayload> = {}): EnvelopePayload {
  return {
    version: "v1",
    sender: "GBTEST000SENDER000000000000000000000000000000000000000000",
    recipient: "GBTEST000RECIPIENT0000000000000000000000000000000000000000",
    timestamp: "2024-01-01T00:00:00.000Z",
    encryption_metadata: {
      algorithm: "AES-256-GCM",
      nonce: "aabbccdd11223344aabbccdd",
      mac: "deadbeefcafebabe00112233445566778899aabbccddeeff00112233445566778899aabb",
    },
    content_commitment: "v1:sha256:hex:abc123",
    attachments: [],
    ...overrides,
  };
}

/** Build a real Ed25519 keypair from the Stellar SDK for signing tests. */
function makeKeypair(): Keypair {
  return Keypair.random();
}

/**
 * Sign a binding preimage with a Stellar Keypair and return the hex signature.
 */
function signBinding(binding: CiphertextBinding, keypair: Keypair, network = "public"): string {
  const preimage = buildBindingPreimage(binding, network);
  const sigBytes = keypair.sign(Buffer.from(preimage));
  return toHex(new Uint8Array(sigBytes));
}

function makeEnvelopeSignature(
  binding: CiphertextBinding,
  keypair: Keypair,
  network = "public",
): EnvelopeSignature {
  return {
    scheme: "Ed25519",
    signerAddress: keypair.publicKey(),
    value: signBinding(binding, keypair, network),
  };
}

// ---------------------------------------------------------------------------
// buildCiphertextBinding
// ---------------------------------------------------------------------------

describe("buildCiphertextBinding", () => {
  it("produces a binding with the correct shape", () => {
    const payload = makePayload();
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:deadbeef");

    expect(binding.version).toBe("v1");
    expect(binding.suite).toBe("AES-256-GCM");
    expect(binding.ciphertext_commitment).toBe("v1:sha256:hex:deadbeef");
    expect(binding.protected_headers.algorithm).toBe("AES-256-GCM");
    expect(binding.protected_headers.nonce).toBe("aabbccdd11223344aabbccdd");
    expect(binding.protected_headers.mac).toBe(
      "deadbeefcafebabe00112233445566778899aabbccddeeff00112233445566778899aabb",
    );
  });

  it("throws when encryption_metadata is missing required fields", () => {
    const payload = makePayload({
      encryption_metadata: { algorithm: "", nonce: "aabbcc", mac: "ddeeff" },
    });
    expect(() => buildCiphertextBinding(payload, "v1:sha256:hex:abc")).toThrow(
      /encryption_metadata must include/,
    );
  });

  it("throws when ciphertextCommitment is empty", () => {
    const payload = makePayload();
    expect(() => buildCiphertextBinding(payload, "")).toThrow(/non-empty string/);
  });
});

// ---------------------------------------------------------------------------
// buildBindingPreimage — determinism and version coverage
// ---------------------------------------------------------------------------

describe("buildBindingPreimage", () => {
  it("is deterministic: same inputs produce identical bytes", () => {
    const payload = makePayload();
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:cafe");

    const a = buildBindingPreimage(binding, "testnet");
    const b = buildBindingPreimage(binding, "testnet");

    expect(a).toEqual(b);
  });

  it("includes the domain tag, version, network, and operation label", () => {
    const payload = makePayload();
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:cafe");
    const preimage = buildBindingPreimage(binding, "testnet", "v1");
    const text = new TextDecoder().decode(preimage);

    expect(text).toContain(STEALTH_DOMAIN_TAG);
    expect(text).toContain(STEALTH_PROTOCOL_VERSION);
    expect(text).toContain("testnet");
    expect(text).toContain(BINDING_OPERATION);
  });

  it("encodes the commitment hash in the preimage (not raw ciphertext bytes)", () => {
    const fakeCiphertextBase64 = btoa("rawciphertextbytes");
    const commitmentHex = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const commitment = `v1:sha256:hex:${commitmentHex}`;

    const payload = makePayload({ content_commitment: commitment });
    const binding = buildCiphertextBinding(payload, commitment);
    const preimage = buildBindingPreimage(binding, "public");
    const text = new TextDecoder().decode(preimage);

    // The versioned commitment hash IS present.
    expect(text).toContain(commitmentHex);
    // The raw base64 ciphertext is NOT present.
    expect(text).not.toContain(fakeCiphertextBase64);
  });

  it("is sensitive to the network parameter", () => {
    const payload = makePayload();
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:cafe");

    const mainnet = buildBindingPreimage(binding, "public");
    const testnet = buildBindingPreimage(binding, "testnet");

    expect(mainnet).not.toEqual(testnet);
  });

  it("is sensitive to the version parameter", () => {
    const payload = makePayload();
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:cafe");

    const v1 = buildBindingPreimage(binding, "public", "v1");
    const v2 = buildBindingPreimage(binding, "public", "v2");

    expect(v1).not.toEqual(v2);
  });
});

// ---------------------------------------------------------------------------
// verifyBindingSignature — real Ed25519 round-trips
// ---------------------------------------------------------------------------

describe("verifyBindingSignature", () => {
  it("returns true for a correctly signed binding", () => {
    const keypair = makeKeypair();
    const payload = makePayload({ sender: keypair.publicKey() });
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:aabbcc");
    const signature = makeEnvelopeSignature(binding, keypair, "testnet");

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "dummybase64==",
      binding,
      signature,
    };

    expect(verifyBindingSignature(envelope, keypair.publicKey(), "testnet")).toBe(true);
  });

  it("returns false when scheme is not Ed25519", () => {
    const keypair = makeKeypair();
    const payload = makePayload({ sender: keypair.publicKey() });
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:aabbcc");

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "x",
      binding,
      signature: {
        scheme: "Ed25519" as never,
        signerAddress: keypair.publicKey(),
        value: ZERO_SIG_HEX,
      },
    };
    // Override scheme to an unsupported value
    (envelope.signature as { scheme: string }).scheme = "secp256k1";

    expect(verifyBindingSignature(envelope, keypair.publicKey())).toBe(false);
  });

  it("returns false when signerAddress does not match expectedSender", () => {
    const keypair = makeKeypair();
    const other = makeKeypair();
    const payload = makePayload({ sender: keypair.publicKey() });
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:aabbcc");
    const signature = makeEnvelopeSignature(binding, keypair);

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "x",
      binding,
      signature: { ...signature, signerAddress: other.publicKey() },
    };

    expect(verifyBindingSignature(envelope, keypair.publicKey())).toBe(false);
  });

  it("returns false when signature value is malformed hex", () => {
    const keypair = makeKeypair();
    const payload = makePayload({ sender: keypair.publicKey() });
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:aabbcc");

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "x",
      binding,
      signature: {
        scheme: "Ed25519",
        signerAddress: keypair.publicKey(),
        value: "not-valid-hex!!!",
      },
    };

    expect(verifyBindingSignature(envelope, keypair.publicKey())).toBe(false);
  });

  it("returns false when the signature covers a different binding (ciphertext substitution)", () => {
    const keypair = makeKeypair();
    const payload = makePayload({ sender: keypair.publicKey() });

    // Original binding
    const originalCommitment =
      "v1:sha256:hex:aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
    const originalBinding = buildCiphertextBinding(payload, originalCommitment);
    const signature = makeEnvelopeSignature(originalBinding, keypair);

    // Attacker replaces ciphertext and re-computes a new commitment — but
    // cannot forge the signature over the NEW binding without the private key.
    const substitutedCommitment =
      "v1:sha256:hex:bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";
    const tamperedBinding = buildCiphertextBinding(
      { ...payload, content_commitment: substitutedCommitment },
      substitutedCommitment,
    );

    const tamperedEnvelope: SignedEnvelope = {
      payload: { ...payload, content_commitment: substitutedCommitment },
      ciphertext: "differentciphertext==",
      binding: tamperedBinding,
      // The ORIGINAL signature is re-used; it does NOT cover tamperedBinding.
      signature,
    };

    expect(verifyBindingSignature(tamperedEnvelope, keypair.publicKey())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Commitment verification — substitution and mismatch
// ---------------------------------------------------------------------------

describe("commitment mismatch on ciphertext substitution", () => {
  it("rejects when verifyCommitment is called with a different ciphertext (substitution attack)", async () => {
    const originalBytes = new TextEncoder().encode("original ciphertext payload");
    const commitment = await createCommitment(originalBytes);

    const substitutedBytes = new TextEncoder().encode("attacker-supplied ciphertext");

    await expect(verifyCommitment(commitment, substitutedBytes)).rejects.toThrow(
      /content commitment did not match/i,
    );
  });

  it("accepts when verifyCommitment is called with the correct ciphertext", async () => {
    const originalBytes = new TextEncoder().encode("original ciphertext payload");
    const commitment = await createCommitment(originalBytes);

    // Must not throw
    await expect(verifyCommitment(commitment, originalBytes)).resolves.toBeUndefined();
  });

  it("rejects a malformed commitment string", async () => {
    const bytes = new TextEncoder().encode("some data");
    await expect(verifyCommitment("not-a-valid-commitment", bytes)).rejects.toThrow();
  });

  it("commitment changes when a single byte in ciphertext changes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const commitment1 = await createCommitment(bytes);

    const mutated = new Uint8Array([1, 2, 3, 4, 6]); // last byte differs
    const commitment2 = await createCommitment(mutated);

    expect(commitment1).not.toBe(commitment2);
  });
});

// ---------------------------------------------------------------------------
// assertBindingConsistency
// ---------------------------------------------------------------------------

describe("assertBindingConsistency", () => {
  it("passes when binding matches the payload fields", () => {
    const payload = makePayload({ content_commitment: "v1:sha256:hex:cafe1234" });
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:cafe1234");

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "x",
      binding,
      signature: {
        scheme: "Ed25519",
        signerAddress: payload.sender,
        value: ZERO_SIG_HEX,
      },
    };

    expect(() => assertBindingConsistency(envelope)).not.toThrow();
  });

  it("throws when the binding commitment differs from payload.content_commitment", () => {
    const payload = makePayload({ content_commitment: "v1:sha256:hex:original" });
    const binding = buildCiphertextBinding(payload, "v1:sha256:hex:different");

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "x",
      binding,
      signature: {
        scheme: "Ed25519",
        signerAddress: payload.sender,
        value: ZERO_SIG_HEX,
      },
    };

    expect(() => assertBindingConsistency(envelope)).toThrow(/tampered/);
  });

  it("throws when protected_headers nonce differs from payload encryption_metadata", () => {
    const payload = makePayload();
    // Build a binding with a different nonce
    const tampered: CiphertextBinding = {
      version: "v1",
      suite: "AES-256-GCM",
      ciphertext_commitment: payload.content_commitment,
      protected_headers: {
        algorithm: "AES-256-GCM",
        nonce: "000000000000000000000000", // different nonce
        mac: payload.encryption_metadata.mac,
      },
    };

    const envelope: SignedEnvelope = {
      payload,
      ciphertext: "x",
      binding: tampered,
      signature: {
        scheme: "Ed25519",
        signerAddress: payload.sender,
        value: ZERO_SIG_HEX,
      },
    };

    expect(() => assertBindingConsistency(envelope)).toThrow(/tampered/);
  });
});
