# Recipient Address Resolution

This feature implements recipient address resolution in the compose interface with clear verification and failure states.

## Overview

Recipients can now be resolved through multiple address formats:

- **Stealth addresses** (S-prefix, 56 chars)
- **Stellar G-addresses** (G-prefix, 56 chars)
- **Federation addresses** (name\*domain format)
- **Contact aliases** (stored locally or in database)

## Resolution States

Each recipient chip displays one of five states:

### Verified ✓

- **Color**: Emerald/green
- **Meaning**: Address has been resolved and cryptographically verified
- **Examples**:
  - Contact found in address book
  - Stellar federation address resolved successfully
  - Stealth address on-chain verified

### Resolving ⟳

- **Color**: Blue (animated pulse)
- **Meaning**: Address is currently being resolved
- **Duration**: Typically <500ms after recipient is added
- **UX**: Users see immediate feedback while system resolves in background

### Unknown ⚠️

- **Color**: Amber/yellow
- **Meaning**: Address format is valid but identity unverified
- **Reason**: No contact match, federation failed, or on-chain data unavailable
- **Action**: Users must explicitly confirm before sending (future feature)

### Invalid ✗

- **Color**: Red
- **Meaning**: Address format is invalid or malformed
- **Reason**: Doesn't match any supported format (Stellar, Stealth, federation, alias)
- **Action**: Compose prevents send until fixed

### Blocked 🚫

- **Color**: Red
- **Meaning**: Recipient is explicitly blocked by user policy
- **Reason**: Added to blocklist or policy prevents sending
- **Action**: Compose prevents send, must be removed from blocklist

## Recipient Chip UI

Each recipient appears as an interactive chip showing:

```
[TRUST ICON] address@domain → S...abc... [encryption indicator]
```

**Components:**

- **Trust Badge**: Visual indicator of verification state
- **Address**: Full recipient input (may show alias or email)
- **Resolved Account**: Truncated Stealth/Stellar address if verified (optional)
- **Encryption Indicator**: Dot showing encryption key is available (optional)
- **Tooltip**: Full message with status details

## Implementation

### Core Components

#### `RecipientResolver` (`recipientResolver.ts`)

Async resolution engine supporting:

- Format validation
- Contact database lookup
- Stellar federation resolution
- Blocked recipient checking
- Batch resolution with debouncing

```typescript
import {
  resolveRecipients,
  type RecipientResolutionContext,
} from "@/features/compose/recipientResolver";

const context: RecipientResolutionContext = {
  resolveContact: async (input) => {
    /* query contact DB */
  },
  resolveFederation: async (address) => {
    /* query federation */
  },
  isBlockedRecipient: async (address) => {
    /* check policy */
  },
};

const resolved = await resolveRecipients(addresses, blockedList, context);
```

#### `Compose` Component

Enhanced with async resolution:

- Real-time resolution as users type
- 300ms debounce to prevent excessive API calls
- Prevents send if recipients are unresolved or blocked
- Shows all resolution states in chips

```typescript
<Compose
  open={true}
  resolutionContext={resolutionContext}
  onSubmit={(submission) => {
    // submission.to has been validated and resolved
  }}
/>
```

#### `RecipientReadinessChips` Component

Displays resolved state with styling:

```typescript
<RecipientReadinessChips recipients={resolvedRecipients} />
```

### Types

```typescript
export type RecipientResolutionState = "resolving" | "verified" | "unknown" | "invalid" | "blocked";

export type RecipientReadiness = {
  address: string;
  state: RecipientResolutionState;
  postage: "ready" | "required";
  message: string;
  resolvedAccount?: string; // Stealth address if verified
  policyType?: "allow" | "block" | "default";
  encryptionKey?: string; // Public key for encryption
};
```

## Validation Rules

**Send prevention conditions:**

1. No recipients entered
2. Any recipient has state: `resolving` or `invalid`
3. Any recipient has state: `blocked`
4. Any recipient lacks required postage
5. No subject line
6. No message body

## Format Validation

Accepted formats (case-insensitive):

- `S[A-Z0-9]{55}` - Stealth address
- `G[A-Z2-7]{55}` - Stellar G-address
- `name*domain.com` - Federation address
- `alias_name` - Contact alias (alphanumeric, underscore, hyphen)

**Rejected:**

- Email addresses (unsupported - use federation format)
- Arbitrary text without @ or \*
- Addresses with spaces or special characters

## Future Enhancements

### Phase 2: Policy Review

- Allow sending to "unknown" recipients if user confirms
- Per-recipient override with "I understand the risk"
- Bulk verify multiple recipients at once

### Phase 3: Federation Integration

- Real Stellar federation lookup via HTTP
- Domain trust management
- SPF/DKIM verification for legacy SMTP

### Phase 4: Contact UI

- Autocomplete suggestions during typing
- Click to add contacts from suggested list
- Quick-add new contact from compose
- Search contacts by name or address

### Phase 5: Encryption Key Management

- Display encryption key fingerprints
- Verify key authenticity
- Key expiration warnings
- Multiple keys per recipient support

## Testing

### Unit Tests

- Format validation for all address types
- Resolution state transitions
- Blocked recipient filtering
- Postage validation

### Integration Tests

- End-to-end resolution flow
- Contact database integration
- Federation resolver fallback
- Send prevention logic

### E2E Tests

- Type recipient → see resolving state
- Wait for resolution → see verified state
- Try to send unresolved → see error
- Try to send blocked → see error
