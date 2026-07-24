import { describe, expect, it } from "vitest";

import {
  deriveKey,
  hkdfExpand,
  hkdfExtract,
  KEY_PURPOSES,
  KdfError,
  type KeyPurpose,
} from "../../../src/services/crypto/kdf";

describe("HKDF key derivation (#1717)", () => {
  const ikm = new Uint8Array(32).map((_, i) => i + 1);
  const salt = new Uint8Array(16).map((_, i) => 200 - i);

  it("each purpose uses a unique fixed context label", () => {
    const labels = Object.values(KEY_PURPOSES);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("derivation is deterministic for the same inputs", async () => {
    const a = await deriveKey(ikm, "body", 32, salt);
    const b = await deriveKey(ikm, "body", 32, salt);
    expect(a).toEqual(b);
  });

  it("outputs are distinct across purposes", async () => {
    const purposes: KeyPurpose[] = ["body", "attachment", "commitment", "wrapping"];
    const outs = await Promise.all(purposes.map((p) => deriveKey(ikm, p, 32, salt)));
    for (let i = 0; i < outs.length; i += 1) {
      for (let j = i + 1; j < outs.length; j += 1) {
        expect(outs[i]).not.toEqual(outs[j]);
      }
    }
  });

  it("honors the requested output length", async () => {
    const out = await deriveKey(ikm, "body", 16, salt);
    expect(out.length).toBe(16);
  });

  it("rejects empty input key material", async () => {
    await expect(deriveKey(new Uint8Array(0), "body", 32)).rejects.toBeInstanceOf(KdfError);
  });

  it("rejects invalid output length", async () => {
    await expect(hkdfExpand(new Uint8Array(32), new Uint8Array(0), 0)).rejects.toBeInstanceOf(
      KdfError,
    );
  });

  it("extract + expand matches a manual composition", async () => {
    const prk = await hkdfExtract(ikm, salt);
    const info = new TextEncoder().encode(KEY_PURPOSES.body);
    const expanded = await hkdfExpand(prk, info, 32);
    const derived = await deriveKey(ikm, "body", 32, salt);
    expect(expanded).toEqual(derived);
  });
});
