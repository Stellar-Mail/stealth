# Crypto Layer Revocation Implementation

## Overview

This document describes the implementation of cryptographic key revocation checking for the Stealth Mail crypto layer. The implementation ensures that revoked keys cannot be used for encryption (sealing) and that signatures from revoked keys fail verification according to configurable timestamp policies.

## Components

### Core Module: `src/services/crypto/revocation.ts`

The revocation module provides:

1. **Key revocation status tracking** - Structured metadata for key revocation state
2. **Recipient key enforcement** - Prevents sealing to revoked keys
3. **Signer key enforcement** - Validates signatures against revocation with timestamp policies
4. **Batch processing** - Filters revoked keys from recipient lists
5. **Clock injection** - Testable time-based revocation decisions

### Test Suite: `tests/unit/crypto/revocation.test.ts`

Comprehensive test coverage (37 tests) verifying:
- Revoked recipient keys are rejected during sealing
- Revoked signer keys fail verification per timestamp policy
- Clock injection enables deterministic testing
- Error messages never leak sensitive data

## Key Interfaces

### RevocationStatus

```typescript
interface RevocationStatus {
  revoked: boolean;
  revokedAt?: string;  // ISO 8601 timestamp
  reason?: string;     // For audit logging only, never exposed in errors
}
```

### KeyWithRevocation

```typescript
interface KeyWithRevocation {
  keyId: string;
  revocation: RevocationStatus;
}
```

### Timestamp Policies

- **verification-time** (default): Check if key is revoked at verification time
- **signing-time**: Check if key was revoked when signature was created

## Security Properties

### 1. No Information Leakage

All errors use fixed public messages from the `CryptoError` registry:
- `crypto_key_error`: "A required cryptographic key was missing or unusable"
- `crypto_signature_error`: "The envelope signature is invalid"

Error messages NEVER contain:
- Full or partial key IDs
- Revocation timestamps
- Revocation reasons
- Any user-identifying information

### 2. Fail-Safe Defaults

- `requireRevocationData: true` (default) - Rejects keys without revocation metadata
- Missing `revokedAt` timestamps treat keys as "always revoked" for maximum safety

### 3. Clock Injection for Testing

```typescript
interface Clock {
  now(): Date;
}
```

Production uses `SYSTEM_CLOCK`, tests can inject frozen or controlled clocks for deterministic verification of timestamp-based revocation logic.

## Usage Examples

### Enforce Recipient Key Not Revoked (Sealing)

```typescript
import { enforceRecipientNotRevoked, KeyWithRevocation } from '@/services/crypto/revocation';

const recipient: KeyWithRevocation = {
  keyId: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  revocation: {
    revoked: false
  }
};

// Throws CryptoError if key is revoked
enforceRecipientNotRevoked(recipient);
```

### Enforce Signer Key Not Revoked (Verification)

```typescript
import { enforceSignerNotRevoked, KeyWithRevocation } from '@/services/crypto/revocation';

const signer: KeyWithRevocation = {
  keyId: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  revocation: {
    revoked: true,
    revokedAt: "2026-01-15T10:00:00Z",
    reason: "Key compromised"
  }
};

// Verification-time policy (default)
try {
  enforceSignerNotRevoked(signer, {
    timestampPolicy: "verification-time"
  });
} catch (error) {
  // CryptoError with code "crypto_signature_error"
}

// Signing-time policy - allows signatures created before revocation
enforceSignerNotRevoked(signer, {
  timestampPolicy: "signing-time",
  signedAt: "2026-01-10T09:00:00Z"  // Before revocation
}); // Does not throw
```

### Batch Filter Revoked Recipients

```typescript
import { filterRevokedRecipients, KeyWithRevocation } from '@/services/crypto/revocation';

const recipients: KeyWithRevocation[] = [
  { keyId: "key1", revocation: { revoked: false } },
  { keyId: "key2", revocation: { revoked: true, revokedAt: "2026-01-15T10:00:00Z" } },
  { keyId: "key3", revocation: { revoked: false } }
];

// Returns only non-revoked keys
const valid = filterRevokedRecipients(recipients);
// Result: [key1, key3]

// Fail-fast mode throws on first revoked key
const validOrThrow = filterRevokedRecipients(recipients, { failFast: true });
// Throws CryptoError
```

## Integration Points

### Envelope Sealing (Future)

The envelope sealing process in `src/services/crypto/envelope.ts` should integrate revocation checks:

```typescript
export async function sealEnvelope(input: SealEnvelopeInput): Promise<SealedEnvelope> {
  // 1. Resolve recipient key from trusted directory
  const recipientKey = await resolveRecipientKey(input.recipient);
  
  // 2. Enforce revocation check
  enforceRecipientNotRevoked(recipientKey);
  
  // 3. Proceed with encryption...
}
```

### Signature Verification (Future)

Signature verification should integrate signer revocation checks:

```typescript
export async function verifyEnvelopeSignature(
  envelope: EnvelopePayload,
  signature: string,
  options: { timestampPolicy?: TimestampPolicy } = {}
): Promise<boolean> {
  // 1. Resolve signer key from signature
  const signerKey = await resolveSignerKey(signature);
  
  // 2. Enforce revocation check with timestamp policy
  enforceSignerNotRevoked(signerKey, {
    timestampPolicy: options.timestampPolicy ?? "verification-time",
    signedAt: envelope.timestamp
  });
  
  // 3. Proceed with cryptographic verification...
}
```

## Test Coverage

The test suite covers all acceptance criteria:

### ✅ Revoked recipient keys are not used for new envelopes
- Tests that `enforceRecipientNotRevoked` throws `CryptoError` for revoked keys
- Tests that active keys pass validation

### ✅ Revoked signer keys fail verification according to timestamp policy
- Tests verification-time policy rejects currently-revoked keys
- Tests signing-time policy allows signatures created before revocation
- Tests signing-time policy rejects signatures created after revocation
- Tests edge cases (exact revocation moment, missing timestamps)

### ✅ Revocation decisions are testable with an injected clock
- Tests that frozen clocks produce deterministic results
- Tests that `SYSTEM_CLOCK` returns current time
- Tests timestamp comparison logic with controlled clocks

### ✅ Errors do not leak sensitive directory data
- Tests that error messages use fixed public strings
- Tests that key IDs never appear in error messages
- Tests that revocation reasons never appear in error messages
- Tests that revocation timestamps never appear in error messages

## Design Decisions

### 1. Separation of Concerns

The revocation module does NOT perform key resolution. It consumes revocation metadata provided by the caller's trusted key resolution layer. This keeps the revocation logic pure and testable.

### 2. Error Safety

All errors use the `CryptoError` type with fixed public messages from the error registry. This prevents accidental information disclosure through error messages.

### 3. Opt-In Relaxed Mode

The `requireRevocationData: false` option allows opt-in to relaxed mode where missing revocation metadata is tolerated. This is useful for:
- Testing and demo scenarios
- Graceful degradation during key directory outages
- Migration periods when not all keys have revocation metadata

### 4. Helper Functions for Testing

The module exports helper functions for creating test keys:
- `createActiveKey(keyId)` - Non-revoked key
- `createRevokedKey(keyId, revokedAt, reason?)` - Revoked key with metadata

## Future Enhancements

1. **Revocation List Caching** - Cache revocation status with TTL to reduce directory lookups
2. **Revocation Reason Codes** - Structured reason codes for programmatic handling
3. **Soft vs Hard Revocation** - Support for temporary key suspension vs permanent revocation
4. **CRL/OCSP Integration** - Support for standard X.509 revocation protocols
5. **Metrics and Monitoring** - Count revocation checks, failures, and missing metadata

## Related Documentation

- [Crypto Services README](./README.md)
- [Crypto Error Taxonomy](./errors.ts)
- [Envelope Specification](../../docs/protocol/messages/envelope_spec.md)

## Change Log

- **2026-07-23**: Initial implementation with comprehensive test coverage
