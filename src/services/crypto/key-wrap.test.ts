import { describe, expect, it } from "vitest";
import {
  wrapContentKey,
  unwrapContentKey,
  wrapContentKeyForRecipients,
  generateRecipientKeyPair,
  importRecipientPublicKey,
  importRecipientPrivateKey,
  exportPublicKey,
  KeyWrapError,
  type WrappedKeyEntry,
} from "./key-wrap";

describe("services/crypto/key-wrap", () => {
  describe("round-trip: wrap and unwrap", () => {
    it("should wrap and unwrap a content key successfully", async () => {
      // Generate recipient key pair
      const recipient = await generateRecipientKeyPair();

      // Generate a content key
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Wrap the content key for the recipient
      const wrapped = await wrapContentKey(contentKey, recipient.publicKey);

      // Verify wrapped entry structure
      expect(wrapped.ephemeralPublicKey).toBeDefined();
      expect(wrapped.blindedRecipientId).toMatch(/^[0-9a-f]+$/);
      expect(wrapped.wrappedKey).toBeDefined();
      expect(wrapped.nonce).toMatch(/^[0-9a-f]{24}$/);

      // Unwrap the content key
      const unwrapped = await unwrapContentKey(recipient.privateKey, [wrapped]);
      expect(unwrapped).not.toBeNull();

      // Verify the unwrapped key matches the original
      const originalKeyBytes = await crypto.subtle.exportKey("raw", contentKey);
      const unwrappedKeyBytes = await crypto.subtle.exportKey("raw", unwrapped!);
      expect(new Uint8Array(unwrappedKeyBytes)).toEqual(new Uint8Array(originalKeyBytes));
    });

    it("should wrap content key for multiple recipients", async () => {
      // Generate multiple recipient key pairs
      const recipient1 = await generateRecipientKeyPair();
      const recipient2 = await generateRecipientKeyPair();
      const recipient3 = await generateRecipientKeyPair();

      // Generate a content key
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Wrap for all recipients
      const wrapped = await wrapContentKeyForRecipients(contentKey, [
        recipient1.publicKey,
        recipient2.publicKey,
        recipient3.publicKey,
      ]);

      expect(wrapped).toHaveLength(3);

      // Each recipient should be able to unwrap
      const unwrapped1 = await unwrapContentKey(recipient1.privateKey, wrapped);
      const unwrapped2 = await unwrapContentKey(recipient2.privateKey, wrapped);
      const unwrapped3 = await unwrapContentKey(recipient3.privateKey, wrapped);

      expect(unwrapped1).not.toBeNull();
      expect(unwrapped2).not.toBeNull();
      expect(unwrapped3).not.toBeNull();

      // Verify all unwrapped keys match
      const originalKeyBytes = await crypto.subtle.exportKey("raw", contentKey);
      const unwrapped1Bytes = await crypto.subtle.exportKey("raw", unwrapped1!);
      const unwrapped2Bytes = await crypto.subtle.exportKey("raw", unwrapped2!);
      const unwrapped3Bytes = await crypto.subtle.exportKey("raw", unwrapped3!);

      expect(new Uint8Array(unwrapped1Bytes)).toEqual(new Uint8Array(originalKeyBytes));
      expect(new Uint8Array(unwrapped2Bytes)).toEqual(new Uint8Array(originalKeyBytes));
      expect(new Uint8Array(unwrapped3Bytes)).toEqual(new Uint8Array(originalKeyBytes));
    });

    it("should return null when no matching wrapped key entry exists", async () => {
      const recipient1 = await generateRecipientKeyPair();
      const recipient2 = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Wrap only for recipient1
      const wrapped = await wrapContentKey(contentKey, recipient1.publicKey);

      // Try to unwrap with recipient2's key (should fail)
      const unwrapped = await unwrapContentKey(recipient2.privateKey, [wrapped]);
      expect(unwrapped).toBeNull();
    });

    it("should return null when wrapped entries array is empty", async () => {
      const recipient = await generateRecipientKeyPair();
      const unwrapped = await unwrapContentKey(recipient.privateKey, []);
      expect(unwrapped).toBeNull();
    });
  });

  describe("wrong key scenarios", () => {
    it("should fail when wrong private key is used", async () => {
      const recipient1 = await generateRecipientKeyPair();
      const recipient2 = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Wrap for recipient1
      const wrapped = await wrapContentKey(contentKey, recipient1.publicKey);

      // Try to unwrap with recipient2's private key
      const unwrapped = await unwrapContentKey(recipient2.privateKey, [wrapped]);
      expect(unwrapped).toBeNull();
    });

    it("should fail when content key is not extractable", async () => {
      const recipient = await generateRecipientKeyPair();

      // Generate non-extractable content key
      const contentKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false, // not extractable
        ["encrypt", "decrypt"],
      );

      await expect(wrapContentKey(contentKey, recipient.publicKey)).rejects.toThrow(KeyWrapError);
      await expect(wrapContentKey(contentKey, recipient.publicKey)).rejects.toThrow(
        /content key must be extractable/,
      );
    });

    it("should fail when trying to wrap a non-secret key", async () => {
      const recipient = await generateRecipientKeyPair();

      // Try to wrap a public key instead of a symmetric secret
      await expect(wrapContentKey(recipient.publicKey, recipient.publicKey)).rejects.toThrow(
        KeyWrapError,
      );
      await expect(wrapContentKey(recipient.publicKey, recipient.publicKey)).rejects.toThrow(
        /content key must be a symmetric secret key/,
      );
    });

    it("should fail when no recipients provided for multi-recipient wrap", async () => {
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      await expect(wrapContentKeyForRecipients(contentKey, [])).rejects.toThrow(KeyWrapError);
      await expect(wrapContentKeyForRecipients(contentKey, [])).rejects.toThrow(
        /at least one recipient public key is required/,
      );
    });

    it("should fail when unwrapping with a public key instead of private key", async () => {
      const recipient = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped = await wrapContentKey(contentKey, recipient.publicKey);

      // Try to unwrap with public key (wrong key type)
      await expect(unwrapContentKey(recipient.publicKey, [wrapped])).rejects.toThrow(KeyWrapError);
      await expect(unwrapContentKey(recipient.publicKey, [wrapped])).rejects.toThrow(
        /recipient key must be a private key/,
      );
    });
  });

  describe("tampering detection", () => {
    it("should fail when wrapped key ciphertext is tampered", async () => {
      const recipient = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped = await wrapContentKey(contentKey, recipient.publicKey);

      // Tamper with the wrapped key
      const tamperedWrapped: WrappedKeyEntry = {
        ...wrapped,
        wrappedKey: wrapped.wrappedKey.slice(0, -4) + "AAAA",
      };

      const unwrapped = await unwrapContentKey(recipient.privateKey, [tamperedWrapped]);
      // Should return null because GCM auth tag verification fails
      expect(unwrapped).toBeNull();
    });

    it("should fail when nonce is tampered", async () => {
      const recipient = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped = await wrapContentKey(contentKey, recipient.publicKey);

      // Tamper with the nonce
      const tamperedWrapped: WrappedKeyEntry = {
        ...wrapped,
        nonce: "000000000000000000000000",
      };

      const unwrapped = await unwrapContentKey(recipient.privateKey, [tamperedWrapped]);
      // Should return null because decryption fails with wrong nonce
      expect(unwrapped).toBeNull();
    });

    it("should fail when blinded recipient ID is tampered", async () => {
      const recipient = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped = await wrapContentKey(contentKey, recipient.publicKey);

      // Tamper with the blinded ID
      const tamperedWrapped: WrappedKeyEntry = {
        ...wrapped,
        blindedRecipientId: "0000000000000000000000000000000000000000000000000000000000000000",
      };

      const unwrapped = await unwrapContentKey(recipient.privateKey, [tamperedWrapped]);
      // Should return null because ID doesn't match
      expect(unwrapped).toBeNull();
    });
  });

  describe("import/export", () => {
    it("should import and export public keys", async () => {
      const { publicKey, publicKeySpkiBase64 } = await generateRecipientKeyPair();

      // Export
      const exported = await exportPublicKey(publicKey);
      expect(exported).toBe(publicKeySpkiBase64);

      // Import
      const imported = await importRecipientPublicKey(publicKeySpkiBase64);

      // Both keys should be usable for wrapping
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped1 = await wrapContentKey(contentKey, publicKey);
      const wrapped2 = await wrapContentKey(contentKey, imported);

      expect(wrapped1).toBeDefined();
      expect(wrapped2).toBeDefined();
    });

    it("should import and export private keys", async () => {
      const { privateKey, privateKeyPkcs8Base64 } = await generateRecipientKeyPair();

      // Import
      const imported = await importRecipientPrivateKey(privateKeyPkcs8Base64);

      // Both keys should be usable for unwrapping
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const { publicKey } = await generateRecipientKeyPair();
      const wrapped = await wrapContentKey(contentKey, publicKey);

      // Neither should be able to unwrap (wrong keys), but both should work without error
      const unwrapped1 = await unwrapContentKey(privateKey, [wrapped]);
      const unwrapped2 = await unwrapContentKey(imported, [wrapped]);

      expect(unwrapped1).toBeNull();
      expect(unwrapped2).toBeNull();
    });

    it("should fail to import invalid public key", async () => {
      await expect(importRecipientPublicKey("invalid-base64!!!")).rejects.toThrow(KeyWrapError);
      await expect(importRecipientPublicKey("aGVsbG8=")).rejects.toThrow(KeyWrapError);
    });

    it("should fail to import invalid private key", async () => {
      await expect(importRecipientPrivateKey("invalid-base64!!!")).rejects.toThrow(KeyWrapError);
      await expect(importRecipientPrivateKey("aGVsbG8=")).rejects.toThrow(KeyWrapError);
    });
  });

  describe("key isolation", () => {
    it("should generate unique ephemeral keys for each wrap operation", async () => {
      const recipient = await generateRecipientKeyPair();

      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped1 = await wrapContentKey(contentKey, recipient.publicKey);
      const wrapped2 = await wrapContentKey(contentKey, recipient.publicKey);

      // Ephemeral keys should be different
      expect(wrapped1.ephemeralPublicKey).not.toBe(wrapped2.ephemeralPublicKey);
      // Nonces should be different
      expect(wrapped1.nonce).not.toBe(wrapped2.nonce);
      // Wrapped keys should be different (different ephemeral keys)
      expect(wrapped1.wrappedKey).not.toBe(wrapped2.wrappedKey);
    });

    it("should generate unique blinded IDs for same recipient with different content keys", async () => {
      const recipient = await generateRecipientKeyPair();

      const contentKey1 = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const contentKey2 = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const wrapped1 = await wrapContentKey(contentKey1, recipient.publicKey);
      const wrapped2 = await wrapContentKey(contentKey2, recipient.publicKey);

      // Even for same recipient, each wrap uses a fresh ephemeral key
      // so blinded IDs will be different
      expect(wrapped1.blindedRecipientId).not.toBe(wrapped2.blindedRecipientId);
    });
  });

  describe("complete flow", () => {
    it("should handle complete sender-to-recipient flow", async () => {
      // Sender side
      const recipient = await generateRecipientKeyPair();

      // Generate message content key
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      // Encrypt message body with content key
      const messageBody = new TextEncoder().encode("Hello, secure world!");
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        contentKey,
        messageBody,
      );

      // Wrap content key for recipient
      const wrappedKey = await wrapContentKey(contentKey, recipient.publicKey);

      // Recipient side
      // Unwrap content key
      const unwrappedKey = await unwrapContentKey(recipient.privateKey, [wrappedKey]);
      expect(unwrappedKey).not.toBeNull();

      // Decrypt message body
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        unwrappedKey!,
        ciphertext,
      );

      const decryptedMessage = new TextDecoder().decode(decrypted);
      expect(decryptedMessage).toBe("Hello, secure world!");
    });
  });
});
