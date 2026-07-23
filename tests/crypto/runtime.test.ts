import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkCapabilities,
  createCryptoAdapter,
  createTestAdapter,
  createMockAdapterWithMissingCapabilities,
  CryptoCapability,
  CryptoCapabilityError,
  getRuntimeInfo,
} from '../../src/services/crypto/runtime';

describe('Crypto Runtime Compatibility', () => {
  describe('checkCapabilities', () => {
    it('should detect all capabilities in a browser-like environment', () => {
      const capabilities = checkCapabilities(false);
      
      expect(capabilities.get(CryptoCapability.GLOBAL_CRYPTO)).toBe(true);
      expect(capabilities.get(CryptoCapability.SUBTLE_CRYPTO)).toBe(true);
      expect(capabilities.get(CryptoCapability.BTOA)).toBe(true);
      expect(capabilities.get(CryptoCapability.TEXT_ENCODER)).toBe(true);
      expect(capabilities.get(CryptoCapability.RANDOM_VALUES)).toBe(true);
    });

    it('should throw on missing capabilities when throwOnMissing is true', () => {
      // Mock a missing capability
      const originalCrypto = globalThis.crypto;
      // @ts-ignore - temporarily remove crypto for test
      delete globalThis.crypto;

      expect(() => checkCapabilities(true)).toThrow(CryptoCapabilityError);
      
      // Restore crypto
      globalThis.crypto = originalCrypto;
    });

    it('should not throw when throwOnMissing is false', () => {
      const originalCrypto = globalThis.crypto;
      // @ts-ignore - temporarily remove crypto for test
      delete globalThis.crypto;

      const capabilities = checkCapabilities(false);
      expect(capabilities.get(CryptoCapability.GLOBAL_CRYPTO)).toBe(false);
      
      // Restore crypto
      globalThis.crypto = originalCrypto;
    });
  });

  describe('createCryptoAdapter', () => {
    it('should create a fully functional adapter in a browser-like environment', () => {
      const adapter = createCryptoAdapter();

      expect(adapter.crypto).toBeDefined();
      expect(adapter.subtle).toBeDefined();
      expect(adapter.btoa).toBeInstanceOf(Function);
      expect(adapter.atob).toBeInstanceOf(Function);
      expect(adapter.encode).toBeInstanceOf(Function);
      expect(adapter.decode).toBeInstanceOf(Function);
      expect(adapter.randomBytes).toBeInstanceOf(Function);
    });

    it('should throw CryptoCapabilityError on missing capabilities', () => {
      const originalCrypto = globalThis.crypto;
      // @ts-ignore - temporarily remove crypto for test
      delete globalThis.crypto;

      expect(() => createCryptoAdapter()).toThrow(CryptoCapabilityError);
      
      // Restore crypto
      globalThis.crypto = originalCrypto;
    });

    it('should generate random bytes securely', () => {
      const adapter = createCryptoAdapter();
      const bytes = adapter.randomBytes(32);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
      expect(bytes.some(b => b !== 0)).toBe(true); // Should have some randomness
    });

    it('should encode and decode text correctly', () => {
      const adapter = createCryptoAdapter();
      const text = 'Hello, World! 🚀';
      
      const encoded = adapter.encode(text);
      expect(encoded).toBeInstanceOf(Uint8Array);
      
      const decoded = adapter.decode(encoded);
      expect(decoded).toBe(text);
    });

    it('should base64 encode and decode correctly', () => {
      const adapter = createCryptoAdapter();
      const text = 'Hello, World!';
      
      const encoded = adapter.btoa(text);
      expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
      
      const decoded = adapter.atob(encoded);
      expect(decoded).toBe(text);
    });
  });

  describe('createTestAdapter', () => {
    it('should create an adapter with overrides', () => {
      const mockRandomBytes = vi.fn(() => new Uint8Array([1, 2, 3, 4]));
      
      const adapter = createTestAdapter({
        randomBytes: mockRandomBytes,
      });

      const result = adapter.randomBytes(4);
      expect(mockRandomBytes).toHaveBeenCalledWith(4);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
  });

  describe('createMockAdapterWithMissingCapabilities', () => {
    it('should create an adapter missing specific capabilities', () => {
      const adapter = createMockAdapterWithMissingCapabilities([
        CryptoCapability.BTOA,
        CryptoCapability.TEXT_ENCODER,
      ]);

      expect(adapter.btoa).toBeUndefined();
      expect(adapter.encode).toBeUndefined();
      expect(adapter.crypto).toBeDefined();
      expect(adapter.randomBytes).toBeDefined();
    });

    it('should still have other capabilities intact', () => {
      const adapter = createMockAdapterWithMissingCapabilities([
        CryptoCapability.BTOA,
      ]);

      expect(adapter.crypto).toBeDefined();
      expect(adapter.subtle).toBeDefined();
      expect(adapter.randomBytes).toBeDefined();
    });
  });

  describe('getRuntimeInfo', () => {
    it('should return a string describing the runtime', () => {
      const info = getRuntimeInfo();
      expect(typeof info).toBe('string');
      expect(info.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should create CryptoCapabilityError with correct fields', () => {
      const error = new CryptoCapabilityError(
        CryptoCapability.GLOBAL_CRYPTO,
        'Crypto not available'
      );

      expect(error.name).toBe('CryptoCapabilityError');
      expect(error.capability).toBe(CryptoCapability.GLOBAL_CRYPTO);
      expect(error.message).toContain('[globalCrypto]');
    });
  });
});
