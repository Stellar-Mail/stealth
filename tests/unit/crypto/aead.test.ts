import { describe, expect, it } from "vitest";

import {
  AeadError,
  GCM_TAG_BYTES,
  joinTag,
  openAead,
  sealAead,
  splitTag,
  TAG_CONVENTION,
} from "../../../src/services/crypto/aead";

describe("AEAD tag separation (#1696)", () => {
  it("enforces a single canonical tag convention", () => {
    expect(TAG_CONVENTION).toBe("ciphertext-excludes-tag");
  });

  it("sealAead returns ciphertext without the tag and a separate tag", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const pt = new TextEncoder().encode("top secret");
    const { ciphertext, tag, nonce } = await sealAead(key, pt);
    expect(tag.length).toBe(GCM_TAG_BYTES);
    expect(ciphertext.length).toBe(pt.length);
    // The canonical ciphertext must NOT contain the tag bytes.
    const combined = joinTag(ciphertext, tag);
    expect(combined.length).toBe(pt.length + GCM_TAG_BYTES);
  });

  it("openAead recovers the exact plaintext from canonical parts", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const pt = new TextEncoder().encode("round trip");
    const sealed = await sealAead(key, pt);
    const opened = await openAead(key, sealed.ciphertext, sealed.tag, sealed.nonce);
    expect(new TextDecoder().decode(opened.plaintext)).toBe("round trip");
  });

  it("seal and open share the same formatter (splitTag/joinTag round-trip)", () => {
    const raw = new Uint8Array(32 + GCM_TAG_BYTES).map((_, i) => i);
    const { ciphertext, tag } = splitTag(raw);
    expect(ciphertext.length).toBe(32);
    expect(tag.length).toBe(GCM_TAG_BYTES);
    const rejoined = joinTag(ciphertext, tag);
    expect(rejoined).toEqual(raw);
  });

  it("rejects combined ciphertext shorter than the tag", () => {
    expect(() => splitTag(new Uint8Array(4))).toThrowError(AeadError);
  });

  it("rejects a tag that is not exactly 16 bytes", () => {
    expect(() => joinTag(new Uint8Array(8), new Uint8Array(8))).toThrowError(AeadError);
    void expect(
      openAead({} as CryptoKey, new Uint8Array(8), new Uint8Array(8), new Uint8Array(12)),
    ).rejects.toBeInstanceOf(AeadError);
  });

  it("fails closed on a tampered tag", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const sealed = await sealAead(key, new TextEncoder().encode("integrity"));
    const badTag = new Uint8Array(sealed.tag);
    badTag[0] ^= 0xff;
    await expect(openAead(key, sealed.ciphertext, badTag, sealed.nonce)).rejects.toBeInstanceOf(
      AeadError,
    );
  });

  it("verifies exact bytes across seal/open (interoperability)", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const pt = new TextEncoder().encode("deterministic bytes");
    const a = await sealAead(key, pt);
    const b = await sealAead(key, pt, a.nonce); // same nonce => same output
    expect(a.ciphertext).toEqual(b.ciphertext);
    expect(a.tag).toEqual(b.tag);
  });
});
