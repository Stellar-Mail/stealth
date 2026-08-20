/**
 * Conformance vectors for the canonical multi-recipient send envelope
 * (issue #1953). Drives protocol/vectors/envelope-send.json through the
 * reference send path (sealEnvelope) and inbound path (openEnvelope +
 * WrappedKeyProvider), proving:
 *
 *  - the body is sealed once and every recipient's wrapped-key entry unwraps
 *    the same content key, so each recipient reads the same Unicode body;
 *  - the envelope carries one wrapped-key entry per recipient with the
 *    recipient_key_id and blinded identifier the inbound path expects;
 *  - the tamper matrix (body ciphertext, wrapped-key entry, wrong recipient
 *    key) fails closed.
 *
 * Keys are generated per-run with Web Crypto; nothing here is mocked.
 */
import { describe, expect, it } from "vitest";
import { sealEnvelope } from "../../../src/services/crypto/envelope";
import { openEnvelope, WrappedKeyProvider } from "../../../src/services/crypto/open-envelope";
import { generateRecipientKeyPair } from "../../../src/services/crypto/key-wrap";
import vectors from "../../../protocol/vectors/envelope-send.json";

function tamperBase64(b64: string, byteIndex: number): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  bytes[byteIndex % Math.max(1, bytes.length)] ^= 0xff;
  let out = "";
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  return btoa(out);
}

describe("envelope send vectors (#1953)", () => {
  const fixture = vectors as any;

  it("seals one canonical envelope with a wrapped-key entry per recipient", async () => {
    const alice = await generateRecipientKeyPair();
    const bob = await generateRecipientKeyPair();

    const sealed = await sealEnvelope({
      sender: fixture.sender,
      recipient: fixture.recipients.primary.account,
      body: fixture.unicodeBody,
      recipientPublicKeys: [alice.publicKeySpkiBase64, bob.publicKeySpkiBase64],
      recipientKeyId: fixture.recipients.primary.keyId,
      attachments: [
        {
          filename: fixture.attachment.filename,
          content_type: fixture.attachment.content_type,
          size_bytes: fixture.attachment.size_bytes,
          data: new TextEncoder().encode("séléctronique attachment bytes").buffer,
        },
      ],
    });

    expect(sealed.payload.version).toBe(fixture.invariants.version);
    expect(sealed.payload.sender).toBe(fixture.sender);
    expect(sealed.payload.recipient).toBe(fixture.recipients.primary.account);
    expect(sealed.payload.encryption_metadata.algorithm).toBe(fixture.invariants.algorithm);
    expect(sealed.payload.encryption_metadata.recipient_key_id).toBe(
      fixture.recipients.primary.keyId,
    );
    expect(sealed.payload.encryption_metadata.nonce).toHaveLength(
      fixture.invariants.bodyNonceHexLength,
    );
    expect(sealed.payload.encryption_metadata.mac).toHaveLength(
      fixture.invariants.bodyMacHexLength,
    );
    expect(sealed.payload.content_commitment).toMatch(
      /^v1:[a-zA-Z0-9]+:[a-zA-Z0-9]+:[a-f0-9]{64}$/,
    );

    expect(sealed.payload.wrapped_keys).toHaveLength(2);
    for (const entry of sealed.payload.wrapped_keys ?? []) {
      expect(entry.wrappedKey.length).toBeGreaterThan(0);
      expect(entry.nonce).toHaveLength(24);
      expect(entry.blindedRecipientId).toHaveLength(64);
      expect(entry.ephemeralPublicKey.length).toBeGreaterThan(0);
    }

    expect(sealed.payload.attachments).toHaveLength(1);
    expect(sealed.payload.attachments[0].filename).toBe(fixture.attachment.filename);
    expect(sealed.payload.attachments[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.payload.attachments[0].encryption_metadata?.algorithm).toBe(
      fixture.invariants.attachmentMetadataAlgorithm,
    );
    expect(sealed.payload.attachments[0].ciphertext).toBeDefined();
  });

  it("lets every recipient unwrap the same Unicode body", async () => {
    const alice = await generateRecipientKeyPair();
    const bob = await generateRecipientKeyPair();

    const sealed = await sealEnvelope({
      sender: fixture.sender,
      recipient: fixture.recipients.primary.account,
      body: fixture.unicodeBody,
      recipientPublicKeys: [alice.publicKeySpkiBase64, bob.publicKeySpkiBase64],
      recipientKeyId: fixture.recipients.primary.keyId,
    });

    const openedAlice = await openEnvelope(
      sealed,
      new WrappedKeyProvider(alice.privateKeyPkcs8Base64),
    );
    expect(openedAlice.body).toBe(fixture.unicodeBody);
    expect(openedAlice.sender).toBe(fixture.sender);
    expect(openedAlice.recipient).toBe(fixture.recipients.primary.account);
    expect(openedAlice.recipientKeyId).toBe(fixture.recipients.primary.keyId);

    const openedBob = await openEnvelope(sealed, new WrappedKeyProvider(bob.privateKeyPkcs8Base64));
    expect(openedBob.body).toBe(fixture.unicodeBody);
  });

  it("fails closed when the body ciphertext is tampered with", async () => {
    const alice = await generateRecipientKeyPair();

    const sealed = await sealEnvelope({
      sender: fixture.sender,
      recipient: fixture.recipients.primary.account,
      body: fixture.unicodeBody,
      recipientPublicKeys: [alice.publicKeySpkiBase64],
      recipientKeyId: fixture.recipients.primary.keyId,
    });

    const tampered = {
      ...sealed,
      ciphertext: tamperBase64(sealed.ciphertext, 0),
    };

    await expect(
      openEnvelope(tampered, new WrappedKeyProvider(alice.privateKeyPkcs8Base64)),
    ).rejects.toMatchObject({ code: "crypto_integrity_error" });
  });

  it("fails closed when a wrapped-key entry is tampered with", async () => {
    const alice = await generateRecipientKeyPair();

    const sealed = await sealEnvelope({
      sender: fixture.sender,
      recipient: fixture.recipients.primary.account,
      body: fixture.unicodeBody,
      recipientPublicKeys: [alice.publicKeySpkiBase64],
      recipientKeyId: fixture.recipients.primary.keyId,
    });

    const entry = (sealed.payload.wrapped_keys ?? [])[0];
    const tampered = {
      ...sealed,
      payload: {
        ...sealed.payload,
        wrapped_keys: [{ ...entry, wrappedKey: tamperBase64(entry.wrappedKey, 0) }],
      },
    };

    await expect(
      openEnvelope(tampered, new WrappedKeyProvider(alice.privateKeyPkcs8Base64)),
    ).rejects.toBeTruthy();
  });

  it("fails closed when a non-recipient attempts to open the envelope", async () => {
    const alice = await generateRecipientKeyPair();
    const bob = await generateRecipientKeyPair();

    const sealed = await sealEnvelope({
      sender: fixture.sender,
      recipient: fixture.recipients.primary.account,
      body: fixture.unicodeBody,
      recipientPublicKeys: [alice.publicKeySpkiBase64],
      recipientKeyId: fixture.recipients.primary.keyId,
    });

    // Bob is not a recipient of this envelope and cannot unwrap Alice's key.
    await expect(
      openEnvelope(sealed, new WrappedKeyProvider(bob.privateKeyPkcs8Base64)),
    ).rejects.toMatchObject({ code: "crypto_decryption_error" });
  });
});
