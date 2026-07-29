import { describe, it, expect } from "vitest";
import {
  createSealingKey,
  createOpeningKey,
  createWrappingKey,
  createUnwrappingKey,
  createSigningKeyPair,
  createVerificationKey,
  KeyUsageError,
} from "./keys";

const RAW = new Uint8Array(32).fill(7);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function iv(): Uint8Array {
  return new Uint8Array(12).fill(1);
}

describe("least-privilege key factories", () => {
  it("mints a sealing key that can only encrypt", async () => {
    const key = await createSealingKey(RAW);
    expect(key.type).toBe("secret");
    expect(key.usages).toEqual(["encrypt"]);
    expect(key.extractable).toBe(false);
  });

  it("mints an opening key that can only decrypt", async () => {
    const key = await createOpeningKey(RAW);
    expect(key.usages).toEqual(["decrypt"]);
    expect(key.extractable).toBe(false);
  });

  it("mints wrapping and unwrapping keys with single usages", async () => {
    const wrap = await createWrappingKey(RAW);
    const unwrap = await createUnwrappingKey(RAW);
    expect(wrap.usages).toEqual(["wrapKey"]);
    expect(unwrap.usages).toEqual(["unwrapKey"]);
  });

  it("round-trips a body between a sealing and an opening key", async () => {
    const nonce = iv();
    const sealing = await createSealingKey(RAW);
    const opening = await createOpeningKey(RAW);
    const message = encoder.encode("least privilege");
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      sealing,
      message as BufferSource,
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      opening,
      ciphertext,
    );
    expect(decoder.decode(plaintext)).toBe("least privilege");
  });

  it("fails predictably when a sealing key is used to decrypt", async () => {
    const sealing = await createSealingKey(RAW);
    await expect(
      crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv() as BufferSource },
        sealing,
        new Uint8Array(32) as BufferSource,
      ),
    ).rejects.toThrow();
  });

  it("rejects symmetric key material of the wrong length", async () => {
    await expect(createSealingKey(new Uint8Array(16))).rejects.toBeInstanceOf(KeyUsageError);
  });

  it("generates a signing pair with split sign / verify usages", async () => {
    const { signingKey, verificationKey } = await createSigningKeyPair();
    expect(signingKey.type).toBe("private");
    expect(signingKey.usages).toEqual(["sign"]);
    expect(signingKey.extractable).toBe(false);
    expect(verificationKey.type).toBe("public");
    expect(verificationKey.usages).toEqual(["verify"]);
  });

  it("signs with the signing key and verifies with an imported verification key", async () => {
    const { signingKey, verificationKey } = await createSigningKeyPair();
    const data = encoder.encode("bind this");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      data as BufferSource,
    );

    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", verificationKey));
    const imported = await createVerificationKey(spki);
    expect(imported.usages).toEqual(["verify"]);

    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      imported,
      signature,
      data as BufferSource,
    );
    expect(ok).toBe(true);
  });

  it("fails predictably when a verification key is used to sign", async () => {
    const { verificationKey } = await createSigningKeyPair();
    await expect(
      crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        verificationKey,
        new Uint8Array(8) as BufferSource,
      ),
    ).rejects.toThrow();
  });
});
