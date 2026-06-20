# Encryption Key Management

Stealth Protocol key discovery, rotation, revocation, and device key management specification.

## Overview

This specification defines how Stealth manages cryptographic keys for end-to-end encryption, including account identity keys, device-specific keys, key publication, rotation, revocation, and historical message access.

## Key Components

1. [Account Keys](#account-keys) - Root identity and signing keys
2. [Device Keys](#device-keys) - Ephemeral per-device encryption keys
3. [Key Publication](#key-publication) - Discovery and distribution mechanism
4. [Key Rotation](#key-rotation) - Safe rotation procedures
5. [Key Revocation](#key-revocation) - Handling compromised keys
6. [Caching Strategy](#caching-strategy) - Client-side key caching
7. [Stale-Key Behavior](#stale-key-behavior) - Legacy key handling
8. [Historical Message Access](#historical-message-access) - Accessing archived messages

---

## Account Keys

### Definition

Account keys are the long-lived cryptographic identity of a Stealth user, tied to their Stellar account.

### Key Types

**Signing Key** (`account:sign`)

- Purpose: Sign account-level operations, key rotation notices, revocation announcements
- Lifetime: Account lifetime (typically permanent)
- Rotation: Rare; requires explicit owner action
- Derivation: Derived from account seed or key manager

**Encryption Key** (`account:encrypt`)

- Purpose: Fallback encryption when device keys are unavailable
- Lifetime: Account lifetime (typically permanent)
- Rotation: Rare; typically rotated with signing key
- Derivation: Derived from account seed or key manager

### Key Constraints

- Account keys MUST be distinct from Stellar signing keys to maintain separation of concerns
- Account keys MUST NOT be shared across devices
- Account signing key MUST be used to verify any account-level announcements

---

## Device Keys

### Definition

Device keys are ephemeral encryption keys specific to a single user agent/device. They enable forward secrecy and limit exposure if a device is compromised.

### Key Lifecycle

1. **Generation**: Created when first accessing Stealth on a new device
2. **Publication**: Announced to the account's key catalog
3. **Active Use**: Primary encryption target for incoming mail
4. **Rotation**: Periodically rotated (recommended: every 30 days or on user request)
5. **Archival**: Retained for historical access after rotation
6. **Expiration**: Deleted after maximum retention period (e.g., 1 year)

### Key Properties

- `device_id`: Unique identifier for the device
- `device_name`: User-friendly name (e.g., "Alice's MacBook")
- `public_key`: X25519 for encryption, or curve agreed in schema
- `created_at`: Timestamp of creation
- `expires_at`: Timestamp of expiration
- `status`: `active`, `rotated`, `revoked`, `expired`

---

## Key Publication

### Discovery Mechanism

Keys are published through a **Key Catalog** associated with each Stealth account:

```
https://stealth.xyz/.well-known/stealth-keys/{stellar_account}
```

Or via on-chain data if integration with Stellar smart contracts is preferred.

### Key Catalog Structure

```json
{
  "account": "GACCOUNT...",
  "catalog_version": "1",
  "updated_at": "2025-01-15T10:30:00Z",
  "keys": {
    "account:sign": {
      "algorithm": "ed25519",
      "public_key": "base64_encoded_key",
      "expires_at": null
    },
    "account:encrypt": {
      "algorithm": "x25519",
      "public_key": "base64_encoded_key",
      "expires_at": null
    },
    "device:...": [
      {
        "device_id": "mac-macbook-pro-2024",
        "device_name": "Alice's MacBook",
        "algorithm": "x25519",
        "public_key": "base64_encoded_key",
        "created_at": "2025-01-01T00:00:00Z",
        "expires_at": "2026-01-01T00:00:00Z",
        "status": "active"
      }
    ]
  },
  "revocations": [
    {
      "key_id": "device:old-iphone",
      "revoked_at": "2025-01-14T15:22:00Z",
      "reason": "device_compromised"
    }
  ],
  "signature": "base64_encoded_signature_by_account:sign"
}
```

### Publication Requirements

- Catalog MUST be signed by the account signing key
- Catalog MUST be published with strong integrity guarantees (TLS, DNSSEC, or on-chain)
- Catalog version MUST increment on each update
- Catalog MUST be globally consistent within a defined window (e.g., 5 minutes)

---

## Key Rotation

### Account Key Rotation

**Scenario**: User rotates their account encryption key (e.g., annual security audit)

**Process**:

1. User initiates rotation through Stealth UI
2. New account signing/encryption key pair generated
3. Rotation announcement signed by **old** account signing key, containing **new** public key
4. Rotation announcement published to key catalog
5. Time window for clients to sync new key (e.g., 48 hours)
6. Old key retained in catalog for historical access during grace period
7. After grace period, old key marked as `deprecated`

**Constraints**:

- Old account signing key signature MUST accompany any rotation announcement
- Clients MUST verify rotation signature using old key before accepting new key
- Rotation propagation time MUST be documented and bounded

### Device Key Rotation

**Scenario**: User's device generates a fresh encryption key

**Process**:

1. Device generates new key pair
2. New device key published to account key catalog
3. Previous device key status changed from `active` to `rotated`
4. Senders target new device key for new messages
5. Old device key retained for decrypting in-transit messages

**Rotation Trigger**:

- Automatic: After 30 days of use
- Manual: User requests rotation for security
- Forced: System detects potential compromise

**Grace Period**: Device must remain available for 7 days to receive any messages encrypted to old key.

---

## Key Revocation

### Revocation Scenario

A device is compromised or lost. The user must prevent it from receiving new mail.

### Revocation Process

1. User initiates revocation (e.g., "I lost my phone")
2. Stealth client generates revocation announcement:
   - Signed by account signing key
   - Contains revoked key ID and reason
   - Timestamped
3. Revocation published to key catalog under `revocations` array
4. Revocation propagates to all known relays/intermediaries
5. Revocation takes effect after propagation window

### Revocation Announcement Structure

```json
{
  "revocation": {
    "key_id": "device:lost-iphone-2024",
    "reason": "device_compromised",
    "revoked_at": "2025-01-15T14:30:00Z",
    "signed_by": "account:sign",
    "propagation_deadline": "2025-01-15T15:30:00Z"
  },
  "signature": "base64_signed_by_account_signing_key"
}
```

### Revocation Semantics

- **Effect**: Revoked device MUST NOT receive new messages after propagation deadline
- **Guarantee**: Best-effort revocation; some in-flight messages may reach revoked device during propagation window
- **Propagation Bound**: Maximum 60 minutes from revocation timestamp to effect
- **Verification**: All clients MUST verify revocation signature using current account signing key

### Revocation Reasons

- `device_lost`: Physical loss of device
- `device_compromised`: Security breach detected
- `account_compromised`: Full account compromise
- `user_requested`: Explicit user action
- `expired`: Key age limit exceeded

---

## Caching Strategy

### Client-Side Key Cache

Stealth clients cache public keys to reduce latency and improve offline support.

### Cache Validation

1. **TTL-based**: Cache expires after 24 hours
2. **Signature-based**: Cache entry validated against current account signing key
3. **Version-based**: Cache invalidated if catalog version advances

### Cache Update Triggers

- **Periodic**: Update every 24 hours
- **Event-driven**: When receiving mail from unknown device
- **User-initiated**: Manual refresh from UI

### Stale Cache Handling

- If cache is stale but signature is valid, use cached key
- If cache is stale and signature cannot be verified, fetch fresh copy
- If cache contains revoked key, immediately purge

---

## Stale-Key Behavior

### Definition

Stale keys are encryption keys that are no longer active but must be retained for historical message decryption.

### Lifecycle

1. **Active Phase**: Key is primary encryption target
2. **Rotation Phase**: Key marked as `rotated`, replaced by new key
3. **Archive Phase**: Key retained for 90 days (configurable) for decryption
4. **Expiration Phase**: Key marked as `expired` and eventually deleted

### Decryption with Stale Keys

- Clients MUST support decrypting messages encrypted to any non-expired key
- Clients SHOULD warn user when accessing old messages
- Old keys MUST NOT be used for encryption (only decryption)

### Propagation

- Stale key status MUST be published in key catalog
- Clients MUST fetch stale key from catalog to decrypt old messages
- If stale key is removed from catalog before expiration, client stores offline copy

---

## Historical Message Access

### Scenario

User accesses archived mail encrypted with a device key that was rotated months ago.

### Access Process

1. Client identifies message encrypted to device key `device:old-device-2024`
2. Client checks local key cache for `device:old-device-2024`
3. If not in cache, client fetches from account key catalog
4. If key is marked `expired` or `revoked`, access denied (with reason)
5. If key is valid but stale, decryption proceeds with warning
6. Decrypted message displayed to user

### Key Retention Requirements

- Account keys: Retained indefinitely for signature verification
- Device keys: Retained for minimum 90 days after rotation (configurable)
- Revoked keys: Retained for 30 days for forensics, then purged

### Offline Access

- Clients SHOULD store decryption keys locally for offline access
- Local key storage MUST be protected with device encryption
- Clients MUST honor revocation notices even for locally-stored keys

---

## Security Considerations

### Signing and Encryption Role Separation

- Account signing key MUST NOT be used for encryption
- Device keys MUST NOT be used to sign rotations or revocations
- Distinct key derivation paths ensure cryptographic separation

### Compromise Scenarios

**Scenario 1: Device Key Compromised**

- Impact: Attacker receives new messages sent to that device
- Mitigation: User revokes device key within 1 hour
- Recovery: Within revocation propagation window, attacker is locked out

**Scenario 2: Account Signing Key Compromised**

- Impact: Attacker can forge key rotations and revocations
- Mitigation: Emergency account freeze (requires out-of-band recovery)
- Recovery: User rotates account key with proof of ownership

**Scenario 3: Key Catalog Compromised**

- Impact: Attacker publishes fraudulent keys
- Mitigation: Signature verification catches fraudulent catalog entries
- Recovery: DNSSEC/TLS pinning prevents man-in-the-middle attacks

### Revocation Propagation Bounds

- Maximum propagation time: 60 minutes
- Guaranteed best-effort delivery of revocation to all recipients
- In-flight messages during propagation window may reach revoked device
- User MUST be aware of grace period when revoking device

---

## Acceptance Criteria ✓

- [x] Signing and encryption roles are distinct
- [x] Rotation preserves verifiable ownership (via account signing key)
- [x] Revocation propagation is bounded (60-minute maximum)
- [x] Compromised-device scenarios are documented
- [x] Key discovery mechanism specified
- [x] Caching strategy defined
- [x] Historical message access supported

---

## Success Signal

**A revoked device cannot receive new mail after the documented 60-minute propagation window.**

Implementation verification:

1. Create test device and publish key to catalog
2. Revoke device key
3. After 60 minutes, send mail to account
4. Verify mail does NOT decrypt on revoked device (or fails at delivery stage)
5. Verify mail DOES decrypt on active device
