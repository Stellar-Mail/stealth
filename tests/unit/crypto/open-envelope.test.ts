import { describe, expect, it } from "vitest";

import {
  openEnvelope,
  OpenEnvelopeError,
  type KeyProvider,
} from "../../../src/services/crypto/open-envelope";
import { createCommitment } from "../../../src/services/crypto/commitment";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a sealed envelope (matching sealEnvelope's format) with a known key. */
async function buildEnvelope(body: string, key: CryptoKey, recipient: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(body);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  const tag = ct.slice(ct.length - 16);
  const ciphertextWithTag = ct; // GCM output already includes the tag
  const commitment = await createCommitment(ciphertextWithTag);
  return {
    payload: {
      version: "v1",
      sender: "GABC",
      recipient,
      timestamp: "2026-07-23T12:00:00.000Z",
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: toHex(iv),
        mac: toHex(tag),
      },
      content_commitment: commitment,
      attachments: [],
    },
    ciphertext: toBase64(ciphertextWithTag),
  };
}

function keyProviderFor(key: CryptoKey, recipient = "GABC"): KeyProvider {
  return {
    resolveKey: async (r) => {
      if (r !== recipient) throw new Error("no key");
      return key;
    },
  };
}

describe("openEnvelope decryption (#1685)", () => {
  it("decrypts a valid envelope to the original plaintext", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const env = await buildEnvelope("hello stealth", key, "GABC");
    const opened = await openEnvelope(env, keyProviderFor(key));
    expect(opened.body).toBe("hello stealth");
    expect(opened.sender).toBe("GABC");
    expect(opened.recipient).toBe("GABC");
  });

  it("fails closed on a tampered ciphertext", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const env = await buildEnvelope("secret message", key, "GABC");
    const bad = toBase64(
      new Uint8Array([
        ...Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([0]))),
        ).slice(0, 4),
        ...new TextEncoder().encode("XXXX"),
      ]),
    );
    const tampered = { payload: env.payload, ciphertext: bad };
    await expect(openEnvelope(tampered, keyProviderFor(key))).rejects.toBeInstanceOf(
      OpenEnvelopeError,
    );
  });

  it("fails closed when the wrong recipient key is used", async () => {
    const keyA = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const keyB = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const env = await buildEnvelope("only for A", keyA, "GABC");
    await expect(openEnvelope(env, keyProviderFor(keyB, "GABC"))).rejects.toBeInstanceOf(
      OpenEnvelopeError,
    );
  });

  it("rejects an unsupported envelope version", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const env = await buildEnvelope("x", key, "GABC");
    const bad = { ...env, payload: { ...env.payload, version: "v2" } };
    const err = await openEnvelope(bad, keyProviderFor(key)).catch((e) => e);
    expect(err).toBeInstanceOf(OpenEnvelopeError);
    expect((err as OpenEnvelopeError).code).toBe("crypto_version_error");
  });

  it("rejects a malformed envelope (missing fields)", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    await expect(
      openEnvelope({ payload: { version: "v1" }, ciphertext: "AAAA" }, keyProviderFor(key)),
    ).rejects.toBeInstanceOf(OpenEnvelopeError);
  });

  it("fails closed when the content commitment is wrong", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const env = await buildEnvelope("check me", key, "GABC");
    const bad = {
      ...env,
      payload: { ...env.payload, content_commitment: "0".repeat(64) },
    };
    await expect(openEnvelope(bad, keyProviderFor(key))).rejects.toBeInstanceOf(OpenEnvelopeError);
  });
});
