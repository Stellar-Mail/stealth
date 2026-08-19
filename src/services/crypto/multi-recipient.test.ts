import { describe, it, expect } from "vitest";
import {
  sealMultiRecipient,
  openMultiRecipient,
  normalizeRecipients,
  MultiRecipientError,
} from "./multi-recipient";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function keyOf(seed: number): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = (seed * 31 + i * 7) % 256;
  }
  return bytes;
}

const alice = { id: "alice@example.test", keyMaterial: keyOf(1) };
const bob = { id: "bob@example.test", keyMaterial: keyOf(2) };
const carol = { id: "carol@example.test", keyMaterial: keyOf(3) };

function tamperBase64(b64: string, byteIndex: number): string {
  const bytes = Buffer.from(b64, "base64");
  bytes[byteIndex] ^= 0xff;
  return bytes.toString("base64");
}

describe("multi-recipient envelope", () => {
  it("lets every recipient independently unwrap the same body", async () => {
    const body = encoder.encode("wire funds to the vendor on Friday");
    const envelope = await sealMultiRecipient(body, [alice, bob, carol]);
    for (const r of [alice, bob, carol]) {
      const opened = await openMultiRecipient(envelope, r.id, r.keyMaterial);
      expect(decoder.decode(opened)).toBe("wire funds to the vendor on Friday");
    }
  });

  it("wraps the content key once per recipient", async () => {
    const envelope = await sealMultiRecipient(encoder.encode("hello"), [alice, bob]);
    expect(envelope.recipients).toHaveLength(2);
    expect(envelope.recipients[0].wrappedKey).not.toBe(envelope.recipients[1].wrappedKey);
  });

  it("prevents one recipient from using another recipient's entry", async () => {
    const envelope = await sealMultiRecipient(encoder.encode("secret"), [alice, bob]);
    await expect(openMultiRecipient(envelope, alice.id, bob.keyMaterial)).rejects.toMatchObject({
      code: "crypto_decrypt_error",
    });
  });

  it("rejects a recipient that has no wrapped-key entry", async () => {
    const envelope = await sealMultiRecipient(encoder.encode("secret"), [alice, bob]);
    await expect(openMultiRecipient(envelope, carol.id, carol.keyMaterial)).rejects.toMatchObject({
      code: "crypto_key_error",
    });
  });

  it("deduplicates duplicate recipients with identical key material", async () => {
    const envelope = await sealMultiRecipient(encoder.encode("hi"), [
      alice,
      { id: "  Alice@Example.test ", keyMaterial: keyOf(1) },
      bob,
    ]);
    expect(envelope.recipients.map((r) => r.recipientId)).toEqual([
      "alice@example.test",
      "bob@example.test",
    ]);
  });

  it("rejects a duplicate id that carries conflicting key material", () => {
    expect(() =>
      normalizeRecipients([alice, { id: "alice@example.test", keyMaterial: keyOf(9) }]),
    ).toThrowError(MultiRecipientError);
  });

  it("rejects an empty recipient list", async () => {
    await expect(sealMultiRecipient(encoder.encode("x"), [])).rejects.toMatchObject({
      code: "crypto_validation_error",
    });
  });

  it("fails closed when the body ciphertext is tampered with", async () => {
    const envelope = await sealMultiRecipient(encoder.encode("do not tamper"), [alice]);
    const tampered = {
      ...envelope,
      body: {
        ...envelope.body,
        ciphertext: tamperBase64(envelope.body.ciphertext, 0),
      },
    };
    await expect(openMultiRecipient(tampered, alice.id, alice.keyMaterial)).rejects.toMatchObject({
      code: "crypto_decrypt_error",
    });
  });

  it("fails closed when a wrapped-key entry is tampered with", async () => {
    const envelope = await sealMultiRecipient(encoder.encode("do not tamper"), [alice, bob]);
    const recipients = envelope.recipients.map((e) =>
      e.recipientId === alice.id ? { ...e, wrappedKey: tamperBase64(e.wrappedKey, 0) } : e,
    );
    const tampered = { ...envelope, recipients };
    await expect(openMultiRecipient(tampered, alice.id, alice.keyMaterial)).rejects.toMatchObject({
      code: "crypto_decrypt_error",
    });
  });
});
