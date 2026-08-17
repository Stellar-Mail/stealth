import { describe, expect, it } from "vitest";
import {
  generateEcdhKeyPair,
  createPrivacyEntry,
  locateAndDecryptEntry,
  type PrivacyPreservingRecipientEntry,
} from "../../../src/services/crypto/recipient-privacy";

describe("Privacy-preserving Recipient Key Entries", () => {
  it("allows the correct recipient to locate and decrypt their entry", async () => {
    // 1. Generate keys
    const recipientKeyPair = await generateEcdhKeyPair();
    const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);

    // 2. Create the privacy entry
    const entry = await createPrivacyEntry(recipientKeyPair.publicKey, contentKey);

    expect(entry.ephemeralPublicKey).toBeDefined();
    expect(entry.blindedRecipientId).toBeDefined();
    expect(entry.wrappedKey).toBeDefined();
    expect(entry.nonce).toBeDefined();

    // The blinded ID should be a secure hex string, not containing the raw public key
    expect(entry.blindedRecipientId).toMatch(/^[0-9a-f]{64}$/);

    // 3. Locate and decrypt
    const decryptedKey = await locateAndDecryptEntry(recipientKeyPair.privateKey, [entry]);

    expect(decryptedKey).toBeDefined();
    expect(decryptedKey).not.toBeNull();

    // Verify the decrypted content key works
    const rawOrig = await crypto.subtle.exportKey("raw", contentKey);
    const rawDec = await crypto.subtle.exportKey("raw", decryptedKey!);
    expect(new Uint8Array(rawOrig)).toEqual(new Uint8Array(rawDec));
  });

  it("does not allow an unrelated recipient to decrypt the entry", async () => {
    const recipientKeyPair1 = await generateEcdhKeyPair();
    const recipientKeyPair2 = await generateEcdhKeyPair();
    const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);

    const entry = await createPrivacyEntry(recipientKeyPair1.publicKey, contentKey);

    // Try decrypting with recipient 2's private key
    const decrypted = await locateAndDecryptEntry(recipientKeyPair2.privateKey, [entry]);
    expect(decrypted).toBeNull();
  });

  it("handles multi-recipient lists and locates the correct entry", async () => {
    const aliceKeys = await generateEcdhKeyPair();
    const bobKeys = await generateEcdhKeyPair();
    const charlieKeys = await generateEcdhKeyPair();

    const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);

    const entryAlice = await createPrivacyEntry(aliceKeys.publicKey, contentKey);
    const entryBob = await createPrivacyEntry(bobKeys.publicKey, contentKey);

    const entries = [entryAlice, entryBob];

    // Alice should locate her entry
    const decryptedAlice = await locateAndDecryptEntry(aliceKeys.privateKey, entries);
    expect(decryptedAlice).not.toBeNull();

    // Bob should locate his entry
    const decryptedBob = await locateAndDecryptEntry(bobKeys.privateKey, entries);
    expect(decryptedBob).not.toBeNull();

    // Charlie should find nothing
    const decryptedCharlie = await locateAndDecryptEntry(charlieKeys.privateKey, entries);
    expect(decryptedCharlie).toBeNull();
  });

  it("defines and handles collision / false-match behavior safely", async () => {
    const aliceKeys = await generateEcdhKeyPair();
    const bobKeys = await generateEcdhKeyPair();

    const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);

    const realEntry = await createPrivacyEntry(aliceKeys.publicKey, contentKey);

    // Construct a malicious/colliding entry with the same blinded ID but forged key wrapper parameters
    const forgedEntry: PrivacyPreservingRecipientEntry = {
      ephemeralPublicKey: realEntry.ephemeralPublicKey,
      blindedRecipientId: realEntry.blindedRecipientId, // Colliding ID
      wrappedKey: "YQAAAAAAAAAAAAAA", // Bad key ciphertext
      nonce: realEntry.nonce,
    };

    // Attempting to locate and decrypt should fail gracefully (fail-closed) and return null
    // since the AES-GCM authentication tag check will fail on the forged wrappedKey.
    const decrypted = await locateAndDecryptEntry(aliceKeys.privateKey, [forgedEntry]);
    expect(decrypted).toBeNull();
  });
});
