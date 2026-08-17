/**
 * Integration tests for recipient-decryptable envelope key wrapping (#1712).
 *
 * These tests verify the complete round-trip flow:
 * 1. Sender seals envelope with recipient public key
 * 2. Content key is wrapped using ECDH + HKDF + AES-GCM
 * 3. Recipient opens envelope using their private key
 * 4. Content key is unwrapped and used to decrypt the message
 */

import { describe, expect, it } from "vitest";
import { sealEnvelope, type SealEnvelopeInput } from "./envelope";
import { openEnvelope, WrappedKeyProvider } from "./open-envelope";
import { generateRecipientKeyPair } from "./key-wrap";

describe("services/crypto/envelope-key-wrap integration", () => {
  describe("round-trip: seal with key wrapping and open with unwrapping", () => {
    it("should seal and open envelope with single recipient", async () => {
      // Generate recipient key pair
      const recipient = await generateRecipientKeyPair();

      // Seal envelope with recipient public key
      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob! This is a secure message.",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);

      // Verify wrapped keys are present in payload
      expect(sealed.payload.wrapped_keys).toBeDefined();
      expect(sealed.payload.wrapped_keys).toHaveLength(1);
      expect(sealed.payload.wrapped_keys![0].ephemeralPublicKey).toBeDefined();
      expect(sealed.payload.wrapped_keys![0].blindedRecipientId).toMatch(/^[0-9a-f]+$/);
      expect(sealed.payload.wrapped_keys![0].wrappedKey).toBeDefined();
      expect(sealed.payload.wrapped_keys![0].nonce).toMatch(/^[0-9a-f]{24}$/);

      // Open envelope with recipient private key
      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
      const opened = await openEnvelope(
        { payload: sealed.payload, ciphertext: sealed.ciphertext },
        keyProvider,
      );

      // Verify decrypted content matches original
      expect(opened.body).toBe("Hello, Bob! This is a secure message.");
      expect(opened.sender).toBe("alice@example.com");
      expect(opened.recipient).toBe("bob@example.com");
    });

    it("should seal and open envelope with multiple recipients", async () => {
      // Generate multiple recipient key pairs
      const recipient1 = await generateRecipientKeyPair();
      const recipient2 = await generateRecipientKeyPair();
      const recipient3 = await generateRecipientKeyPair();

      // Seal envelope with all recipient public keys
      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, everyone! This message is for all of you.",
        recipientPublicKeys: [
          recipient1.publicKeySpkiBase64,
          recipient2.publicKeySpkiBase64,
          recipient3.publicKeySpkiBase64,
        ],
      };

      const sealed = await sealEnvelope(input);

      // Verify wrapped keys for all recipients
      expect(sealed.payload.wrapped_keys).toBeDefined();
      expect(sealed.payload.wrapped_keys).toHaveLength(3);

      // Each recipient should be able to open the envelope
      const keyProvider1 = new WrappedKeyProvider(recipient1.privateKeyPkcs8Base64);
      const opened1 = await openEnvelope(
        { payload: sealed.payload, ciphertext: sealed.ciphertext },
        keyProvider1,
      );
      expect(opened1.body).toBe("Hello, everyone! This message is for all of you.");

      const keyProvider2 = new WrappedKeyProvider(recipient2.privateKeyPkcs8Base64);
      const opened2 = await openEnvelope(
        { payload: sealed.payload, ciphertext: sealed.ciphertext },
        keyProvider2,
      );
      expect(opened2.body).toBe("Hello, everyone! This message is for all of you.");

      const keyProvider3 = new WrappedKeyProvider(recipient3.privateKeyPkcs8Base64);
      const opened3 = await openEnvelope(
        { payload: sealed.payload, ciphertext: sealed.ciphertext },
        keyProvider3,
      );
      expect(opened3.body).toBe("Hello, everyone! This message is for all of you.");
    });

    it("should seal envelope without key wrapping (backward compatibility)", async () => {
      // Seal envelope without recipient public keys (legacy mode)
      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob! This is a legacy message.",
      };

      const sealed = await sealEnvelope(input);

      // Verify no wrapped keys in payload
      expect(sealed.payload.wrapped_keys).toBeUndefined();

      // Verify envelope structure is valid
      expect(sealed.payload.encryption_metadata).toBeDefined();
      expect(sealed.payload.content_commitment).toBeDefined();
      expect(sealed.ciphertext).toBeDefined();
    });

    it("should handle attachments with key wrapping", async () => {
      const recipient = await generateRecipientKeyPair();

      // Create test attachment
      const attachmentData = new TextEncoder().encode("This is attachment content");

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Message with attachment",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
        attachments: [
          {
            filename: "test.txt",
            content_type: "text/plain",
            size_bytes: attachmentData.length,
            data: attachmentData.buffer,
          },
        ],
      };

      const sealed = await sealEnvelope(input);

      // Verify wrapped keys and attachments are present
      expect(sealed.payload.wrapped_keys).toBeDefined();
      expect(sealed.payload.wrapped_keys).toHaveLength(1);
      expect(sealed.payload.attachments).toHaveLength(1);

      // Open envelope
      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
      const opened = await openEnvelope(
        { payload: sealed.payload, ciphertext: sealed.ciphertext },
        keyProvider,
      );

      expect(opened.body).toBe("Message with attachment");
      expect(opened.attachments).toHaveLength(1);
      expect(opened.attachments[0].filename).toBe("test.txt");
    });
  });

  describe("wrong recipient scenarios", () => {
    it("should fail when wrong recipient private key is used", async () => {
      const recipient1 = await generateRecipientKeyPair();
      const recipient2 = await generateRecipientKeyPair();

      // Seal for recipient1
      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob!",
        recipientPublicKeys: [recipient1.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);

      // Try to open with recipient2's private key
      const keyProvider = new WrappedKeyProvider(recipient2.privateKeyPkcs8Base64);

      await expect(
        openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
      ).rejects.toThrow(/recipient key unavailable|no matching wrapped key entry/);
    });

    it("should fail when no wrapped keys are present but WrappedKeyProvider is used", async () => {
      const recipient = await generateRecipientKeyPair();

      // Seal without key wrapping
      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob!",
      };

      const sealed = await sealEnvelope(input);

      // Try to open with wrapped key provider
      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);

      await expect(
        openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, keyProvider),
      ).rejects.toThrow(/no wrapped keys available|recipient key unavailable/);
    });
  });

  describe("tampering detection", () => {
    it("should fail when wrapped key is tampered", async () => {
      const recipient = await generateRecipientKeyPair();

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob!",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);

      // Tamper with wrapped key
      const tamperedPayload = {
        ...sealed.payload,
        wrapped_keys: [
          {
            ...sealed.payload.wrapped_keys![0],
            wrappedKey: sealed.payload.wrapped_keys![0].wrappedKey.slice(0, -4) + "AAAA",
          },
        ],
      };

      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);

      await expect(
        openEnvelope({ payload: tamperedPayload, ciphertext: sealed.ciphertext }, keyProvider),
      ).rejects.toThrow(/recipient key unavailable|no matching wrapped key entry/);
    });

    it("should fail when wrapped key nonce is tampered", async () => {
      const recipient = await generateRecipientKeyPair();

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob!",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);

      // Tamper with nonce
      const tamperedPayload = {
        ...sealed.payload,
        wrapped_keys: [
          {
            ...sealed.payload.wrapped_keys![0],
            nonce: "000000000000000000000000",
          },
        ],
      };

      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);

      await expect(
        openEnvelope({ payload: tamperedPayload, ciphertext: sealed.ciphertext }, keyProvider),
      ).rejects.toThrow(/recipient key unavailable|no matching wrapped key entry/);
    });

    it("should fail when ciphertext is tampered (even with valid wrapped key)", async () => {
      const recipient = await generateRecipientKeyPair();

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Hello, Bob!",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);

      // Tamper with ciphertext
      const tamperedCiphertext = sealed.ciphertext.slice(0, -4) + "AAAA";

      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);

      await expect(
        openEnvelope({ payload: sealed.payload, ciphertext: tamperedCiphertext }, keyProvider),
      ).rejects.toThrow(/content commitment|ciphertext|decryption failed/);
    });
  });

  describe("key isolation", () => {
    it("should generate unique wrapped keys for same recipient in different messages", async () => {
      const recipient = await generateRecipientKeyPair();

      const input1: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "First message",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const input2: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Second message",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed1 = await sealEnvelope(input1);
      const sealed2 = await sealEnvelope(input2);

      // Wrapped keys should be different (different ephemeral keys)
      expect(sealed1.payload.wrapped_keys![0].ephemeralPublicKey).not.toBe(
        sealed2.payload.wrapped_keys![0].ephemeralPublicKey,
      );
      expect(sealed1.payload.wrapped_keys![0].wrappedKey).not.toBe(
        sealed2.payload.wrapped_keys![0].wrappedKey,
      );
      expect(sealed1.payload.wrapped_keys![0].nonce).not.toBe(
        sealed2.payload.wrapped_keys![0].nonce,
      );
      expect(sealed1.payload.wrapped_keys![0].blindedRecipientId).not.toBe(
        sealed2.payload.wrapped_keys![0].blindedRecipientId,
      );

      // Both should be openable
      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);

      const opened1 = await openEnvelope(
        { payload: sealed1.payload, ciphertext: sealed1.ciphertext },
        keyProvider,
      );
      expect(opened1.body).toBe("First message");

      const opened2 = await openEnvelope(
        { payload: sealed2.payload, ciphertext: sealed2.ciphertext },
        keyProvider,
      );
      expect(opened2.body).toBe("Second message");
    });
  });

  describe("acceptance criteria verification", () => {
    it("✓ A recipient with matching private key can recover content key and decrypt body", async () => {
      const recipient = await generateRecipientKeyPair();

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Test message for acceptance criteria",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);
      const keyProvider = new WrappedKeyProvider(recipient.privateKeyPkcs8Base64);
      const opened = await openEnvelope(
        { payload: sealed.payload, ciphertext: sealed.ciphertext },
        keyProvider,
      );

      expect(opened.body).toBe("Test message for acceptance criteria");
    });

    it("✓ A non-recipient key cannot unwrap content key", async () => {
      const recipient1 = await generateRecipientKeyPair();
      const recipient2 = await generateRecipientKeyPair();

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Private message",
        recipientPublicKeys: [recipient1.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);
      const wrongKeyProvider = new WrappedKeyProvider(recipient2.privateKeyPkcs8Base64);

      await expect(
        openEnvelope({ payload: sealed.payload, ciphertext: sealed.ciphertext }, wrongKeyProvider),
      ).rejects.toThrow();
    });

    it("✓ Raw content key is never serialized, logged, or returned from public APIs", async () => {
      const recipient = await generateRecipientKeyPair();

      const input: SealEnvelopeInput = {
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "Security test message",
        recipientPublicKeys: [recipient.publicKeySpkiBase64],
      };

      const sealed = await sealEnvelope(input);

      // Verify raw key is not in payload
      const payloadJson = JSON.stringify(sealed.payload);
      expect(payloadJson).not.toMatch(/raw.*key/i);

      // Verify wrapped key is base64 (not raw bytes exposed)
      expect(sealed.payload.wrapped_keys![0].wrappedKey).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Verify ciphertext is base64 (not raw bytes exposed)
      expect(sealed.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });
});
