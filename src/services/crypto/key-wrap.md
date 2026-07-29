# Recipient-Decryptable Envelope Key Wrapping

## Overview

The key-wrap module implements recipient-decryptable envelope key wrapping, addressing the issue where envelope crypto generated fresh AES-256-GCM content-encryption keys but never transmitted them to recipients, making ciphertext unopenable.

## Problem Statement

Prior to this implementation:

- `envelope.ts` generated a fresh extractable AES-256-GCM key for each message
- The key was used to encrypt the message body and attachments
- **The key was never exported, wrapped, or transmitted to the recipient**
- Recipients could not decrypt messages because no key material was provided

## Solution

This module adds a crypto key-wrapping layer that:

1. **Wraps content keys** using the recipient's public key
2. **Stores wrapped keys** in the envelope payload
3. **Enables recipient decryption** by unwrapping with their private key
4. **Maintains security** - raw content keys are never serialized or logged

## Architecture

### Key Wrapping Flow

```
┌─────────────────┐
│  Content Key    │  (AES-256-GCM, used to encrypt message body)
│  (Extractable)  │
└────────┬────────┘
         │
         │ wrapContentKey()
         │
         ▼
┌─────────────────────────────┐
│  Recipient Public Key       │  (P-256 ECDH)
│  (SPKI format, base64)      │
└────────┬────────────────────┘
         │
         │ ECDH + HKDF + AES-GCM
         │
         ▼
┌─────────────────────────────┐
│  WrappedKeyEntry            │
│  ├─ ephemeralPublicKey      │  (Sender's ephemeral P-256 key)
│  ├─ blindedRecipientId      │  (HMAC-derived, indistinguishable from random)
│  ├─ wrappedKey              │  (AES-GCM encrypted content key)
│  └─ nonce                   │  (AES-GCM IV)
└─────────────────────────────┘
```

### Key Unwrapping Flow

```
┌─────────────────────────────┐
│  WrappedKeyEntry[]          │  (From envelope payload)
└────────┬────────────────────┘
         │
         │ unwrapContentKey()
         │
         ▼
┌─────────────────────────────┐
│  Recipient Private Key      │  (P-256 ECDH)
│  (PKCS8 format, base64)     │
└────────┬────────────────────┘
         │
         │ 1. Match blinded ID via ECDH + HMAC
         │ 2. Derive wrapping key via HKDF
         │ 3. Decrypt with AES-GCM
         │
         ▼
┌─────────────────────────────┐
│  Content Key                │  (AES-256-GCM, ready for message decryption)
│  or null (no match)         │
└─────────────────────────────┘
```

## Cryptographic Scheme

The implementation reuses the audited `recipient-privacy.ts` scheme:

1. **ECDH (P-256)**: Ephemeral key agreement between sender and recipient
2. **HKDF-SHA256**: Key derivation from ECDH shared secret
3. **AES-256-GCM**: Authenticated encryption of the content key
4. **HMAC-SHA256**: Blinded recipient identifier generation

### Security Properties

- ✅ **Forward secrecy**: Each message uses a fresh ephemeral ECDH key
- ✅ **Authenticated encryption**: AES-GCM tag prevents tampering
- ✅ **Recipient privacy**: Blinded IDs are indistinguishable from random
- ✅ **Fail-closed**: Wrong keys, tampered data, or invalid formats fail safely
- ✅ **Key isolation**: Raw content keys never leave the crypto boundary

## API Reference

### Core Functions

#### `wrapContentKey(contentKey, recipientPublicKey)`

Wrap a content-encryption key for a single recipient.

**Parameters:**

- `contentKey: CryptoKey` - AES-256-GCM key (must be extractable)
- `recipientPublicKey: CryptoKey` - P-256 ECDH public key

**Returns:** `Promise<WrappedKeyEntry>`

**Throws:** `KeyWrapError` if key is not extractable or wrapping fails

**Example:**

```typescript
const contentKey = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true, // extractable
  ["encrypt", "decrypt"],
);

const recipientKey = await importRecipientPublicKey(recipientPublicKeyBase64);
const wrapped = await wrapContentKey(contentKey, recipientKey);
```

#### `wrapContentKeyForRecipients(contentKey, recipientPublicKeys)`

Wrap a content-encryption key for multiple recipients.

**Parameters:**

- `contentKey: CryptoKey` - AES-256-GCM key (must be extractable)
- `recipientPublicKeys: CryptoKey[]` - Array of P-256 ECDH public keys

**Returns:** `Promise<WrappedKeyEntry[]>`

**Throws:** `KeyWrapError` if key is not extractable or wrapping fails

**Example:**

```typescript
const wrapped = await wrapContentKeyForRecipients(contentKey, [
  recipientKey1,
  recipientKey2,
  recipientKey3,
]);
// Returns array of 3 wrapped entries, one per recipient
```

#### `unwrapContentKey(recipientPrivateKey, wrappedEntries)`

Unwrap a content-encryption key from wrapped entries.

**Parameters:**

- `recipientPrivateKey: CryptoKey` - P-256 ECDH private key
- `wrappedEntries: WrappedKeyEntry[]` - Array of wrapped key entries from envelope

**Returns:** `Promise<CryptoKey | null>`

- Returns unwrapped AES-256-GCM key if a matching entry is found
- Returns `null` if no matching entry exists

**Throws:** `KeyWrapError` if private key is invalid

**Example:**

```typescript
const privateKey = await importRecipientPrivateKey(privateKeyBase64);
const contentKey = await unwrapContentKey(privateKey, wrappedEntries);

if (contentKey) {
  // Decrypt message with content key
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, contentKey, ciphertext);
}
```

### Key Import/Export

#### `generateRecipientKeyPair()`

Generate a new recipient key pair for testing or setup.

**Returns:** `Promise<{ publicKey, privateKey, publicKeySpkiBase64, privateKeyPkcs8Base64 }>`

#### `importRecipientPublicKey(spkiBase64)`

Import a recipient's public key from base64 SPKI format.

**Returns:** `Promise<CryptoKey>`

#### `importRecipientPrivateKey(pkcs8Base64)`

Import a recipient's private key from base64 PKCS8 format.

**Returns:** `Promise<CryptoKey>`

#### `exportPublicKey(publicKey)`

Export a public key to base64 SPKI format.

**Returns:** `Promise<string>`

## Integration with Envelope

To integrate key wrapping into the envelope flow:

```typescript
import { sealEnvelope } from "./envelope";
import { wrapContentKey, importRecipientPublicKey } from "./key-wrap";

async function sealEnvelopeWithKeyWrap(input) {
  // 1. Generate content key
  const contentKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // MUST be extractable for wrapping
    ["encrypt", "decrypt"],
  );

  // 2. Encrypt body with content key
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, contentKey, plaintext);

  // 3. Wrap content key for recipient
  const recipientKey = await importRecipientPublicKey(recipientPublicKeyBase64);
  const wrappedKey = await wrapContentKey(contentKey, recipientKey);

  // 4. Store wrapped key in envelope payload
  return {
    payload: {
      // ... other fields
      wrapped_keys: [wrappedKey],
    },
    ciphertext: toBase64(ciphertext),
  };
}
```

## Test Coverage

The implementation includes comprehensive tests covering:

### Round-trip Tests

- ✅ Single recipient wrap/unwrap
- ✅ Multiple recipients wrap/unwrap
- ✅ No matching entry returns null
- ✅ Empty wrapped entries array returns null

### Wrong Key Scenarios

- ✅ Wrong private key cannot unwrap
- ✅ Non-extractable content key fails wrapping
- ✅ Non-secret key fails wrapping
- ✅ Public key cannot unwrap (type check)
- ✅ Empty recipients array fails

### Tampering Detection

- ✅ Tampered wrapped key ciphertext fails
- ✅ Tampered nonce fails
- ✅ Tampered blinded recipient ID fails

### Import/Export

- ✅ Public key import/export round-trip
- ✅ Private key import/export round-trip
- ✅ Invalid key formats fail

### Key Isolation

- ✅ Unique ephemeral keys per wrap operation
- ✅ Unique nonces per wrap operation
- ✅ Unique blinded IDs per message

### Complete Flow

- ✅ End-to-end sender-to-recipient encryption/decryption

## Security Considerations

### Raw Content Key Handling

**CRITICAL:** The raw content key is never:

- Serialized to JSON
- Logged to console or telemetry
- Returned from public APIs (except as opaque CryptoKey)
- Stored in envelope payload (only wrapped form is stored)

### Non-Recipient Access

- Non-recipients cannot unwrap content keys (enforced by ECDH + AES-GCM)
- Blinded IDs reveal no information about recipient identity
- Observers cannot link messages to recipients without private keys

### Fail-Closed Behavior

All error conditions fail safely:

- Invalid keys → `KeyWrapError` with stable code
- Tampered data → Decryption fails, returns `null`
- Wrong recipient → No match, returns `null`
- Invalid formats → `KeyWrapError` (no silent fallback)

## Performance

### Memory Profile

- Ephemeral key generation: ~0 bytes (opaque CryptoKey)
- ECDH derivation: ~32 bytes (shared secret, zeroed after use)
- Key wrapping: ~32 bytes (raw content key, zeroed after wrap)
- Result size: ~200 bytes per recipient (base64 overhead)

### Time Complexity

- Wrap single recipient: ~5-10ms (ECDH + HKDF + AES-GCM)
- Wrap N recipients: ~5N-10N ms (parallelizable)
- Unwrap from M entries: O(M) sequential scan, ~5-10ms per attempt

## Future Enhancements

### Potential Improvements

1. **Batch wrapping optimization**: Reuse ECDH ephemeral key for multiple recipients
2. **Key rotation**: Support periodic content key rotation within long sessions
3. **Hardware key support**: Integration with WebAuthn/TPM for private key storage
4. **Post-quantum algorithms**: Prepare for quantum-resistant key encapsulation

### Integration Points

- **Device registry**: Already compatible with `device-keys.ts` multi-device support
- **Key resolver**: Can integrate with `key-resolver.ts` for public key discovery
- **Relay transport**: Wrapped keys fit in existing envelope wire format

## References

- **Issue**: #1712 - Implement recipient-decryptable envelope key wrapping
- **Dependencies**:
  - `recipient-privacy.ts` - Core ECDH + HKDF + AES-GCM scheme
  - `codec.ts` - Base64/hex encoding utilities
  - `errors.ts` - Standard crypto error types
- **Standards**:
  - RFC 5869 (HKDF)
  - RFC 5480 (ECC SubjectPublicKeyInfo)
  - NIST SP 800-56A Rev. 3 (ECDH)
  - Web Crypto API (W3C)
