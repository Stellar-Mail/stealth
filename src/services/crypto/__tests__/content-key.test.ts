import { generateContentKey } from '../content-key';

describe('Content Key Security - Non-extractable default (#1691)', () => {
  it('should generate content-encryption keys as non-extractable by default', async () => {
    const key = await generateContentKey();
    
    expect(key).toBeDefined();
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
  });

  it('should fail when attempting to export a default non-extractable key', async () => {
    const key = await generateContentKey();

    // Exporting non-extractable key should reject in Web Crypto API
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('should allow encrypt and decrypt operations with non-extractable key', async () => {
    const key = await generateContentKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode('Hello, Stealth Mail!');

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    expect(new TextDecoder().decode(decrypted)).toBe('Hello, Stealth Mail!');
  });
});
