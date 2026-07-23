import { describe, expect, it } from "vitest";
import {
  KEY_USAGES,
  OPEN_CONTENT_KEY_USAGES,
  SEAL_CONTENT_KEY_USAGES,
  assertKeyUsages,
  generateSealContentKey,
  importKeyUnwrappingKey,
  importKeyWrappingKey,
  importOpenContentKey,
  importSigningKey,
  importVerificationKey,
} from "./keys";

describe("services/crypto/keys", () => {
  it("exposes the smallest usage set for every operation", () => {
    expect(KEY_USAGES.seal).toEqual(["encrypt"]);
    expect(KEY_USAGES.open).toEqual(["decrypt"]);
    expect(KEY_USAGES.wrap).toEqual(["wrapKey"]);
    expect(KEY_USAGES.unwrap).toEqual(["unwrapKey"]);
    expect(KEY_USAGES.sign).toEqual(["sign"]);
    expect(KEY_USAGES.verify).toEqual(["verify"]);
  });

  it("mints a seal content key with only the encrypt usage", async () => {
    const key = await generateSealContentKey();
    expect(key.type).toBe("secret");
    expect(key.usages).toEqual(["encrypt"]);
    expect(key.extractable).toBe(true);
  });

  it("imports an open content key with only the decrypt usage", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importOpenContentKey(raw);
    expect(key.usages).toEqual(["decrypt"]);
    expect(key.extractable).toBe(false);
  });

  it("gives wrapping and unwrapping keys their single matching usage", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const wrapKey = await importKeyWrappingKey(raw);
    const unwrapKey = await importKeyUnwrappingKey(raw);
    expect(wrapKey.usages).toEqual(["wrapKey"]);
    expect(unwrapKey.usages).toEqual(["unwrapKey"]);
  });

  it("gives signing and verification keys their single matching usage", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const signKey = await importSigningKey(raw);
    const verifyKey = await importVerificationKey(raw);
    expect(signKey.usages).toEqual(["sign"]);
    expect(verifyKey.usages).toEqual(["verify"]);
  });

  it("rejects AES key material that is not 32 bytes", async () => {
    await expect(importOpenContentKey(new Uint8Array(16))).rejects.toThrow(
      /must be exactly 32 bytes/,
    );
  });

  it("fails closed when an encrypt-only seal key is used to decrypt", async () => {
    const key = await generateSealContentKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, new Uint8Array(32)),
    ).rejects.toThrow();
  });

  it("assertKeyUsages accepts the matching set and rejects any other", async () => {
    const key = await generateSealContentKey();
    expect(() => assertKeyUsages(key, SEAL_CONTENT_KEY_USAGES)).not.toThrow();
    expect(() => assertKeyUsages(key, OPEN_CONTENT_KEY_USAGES)).toThrow(/least-privilege/);
  });
});
