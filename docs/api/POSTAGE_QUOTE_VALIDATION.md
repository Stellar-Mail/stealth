# Postage Quote Validation

## Overview

The postage quote endpoint (`POST /api/v1/postage/quote`) implements strict validation for Stellar address identifiers to ensure reliable and secure quote generation. This document details the validation rules, error responses, and boundary cases.

## Endpoint

```http
POST /api/v1/postage/quote
Content-Type: application/json

{
  "recipient": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "sender": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
}
```

## Validation Rules

### Stellar Address Format

Both `recipient` and `sender` must be valid Stellar G-addresses conforming to:

1. **Prefix**: Must start with `G`
2. **Length**: Exactly 56 characters (G + 55 base32 characters)
3. **Character Set**: Only valid base32 characters (A-Z, 2-7)
4. **No Invalid Characters**: Cannot contain 0, 1, 8, 9, or special characters

### Normalization

The endpoint automatically normalizes valid addresses:

- **Whitespace**: Leading and trailing whitespace is trimmed
- **Case**: Lowercase letters are converted to uppercase

```javascript
// These are all normalized to the same address:
"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
"gaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
"  GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA  ";
"  gaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ";
```

## Error Responses

### 422 Validation Error

Invalid identifiers return a 422 status code with the `validation_error` code:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": {
      "fieldErrors": {
        "recipient": ["Expected a Stellar G-address"]
      },
      "formErrors": []
    }
  },
  "meta": {
    "requestId": "...",
    "timestamp": "2026-07-19T..."
  }
}
```

### Error Triggers

The following inputs trigger validation errors:

#### Empty or Whitespace

```json
// ❌ Empty string
{ "recipient": "", "sender": "GBBBB..." }

// ❌ Whitespace only
{ "recipient": "   ", "sender": "GBBBB..." }
```

#### Invalid Prefix

```json
// ❌ Wrong prefix (must be 'G')
{ "recipient": "MAAAA...", "sender": "GBBBB..." }
{ "recipient": "XAAAA...", "sender": "GBBBB..." }
```

#### Invalid Length

```json
// ❌ Too short (< 56 chars)
{ "recipient": "GAAAAA", "sender": "GBBBB..." }
{ "recipient": "G", "sender": "GBBBB..." }

// ❌ Too long (> 56 chars)
{ "recipient": "GAAAAAAAAAA...[100 chars]", "sender": "GBBBB..." }
```

#### Invalid Characters

```json
// ❌ Invalid base32 characters (0, 1, 8, 9)
{ "recipient": "G00000000000000000000000000000000000000000000000000000", "sender": "GBBBB..." }
{ "recipient": "G11111111111111111111111111111111111111111111111111111", "sender": "GBBBB..." }

// ❌ Special characters
{ "recipient": "GAAAAAAAAAAAAAAA@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "sender": "GBBBB..." }
{ "recipient": "GAAAAAAAAAAAAAAA*AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "sender": "GBBBB..." }
```

#### Invalid Types

```json
// ❌ Null
{ "recipient": null, "sender": "GBBBB..." }

// ❌ Undefined
{ "recipient": undefined, "sender": "GBBBB..." }

// ❌ Number
{ "recipient": 12345, "sender": "GBBBB..." }

// ❌ Object
{ "recipient": { "address": "GAAAA..." }, "sender": "GBBBB..." }

// ❌ Array
{ "recipient": ["GAAAA..."], "sender": "GBBBB..." }

// ❌ Boolean
{ "recipient": true, "sender": "GBBBB..." }
```

## Boundary Cases

### Exact Length Boundaries

```javascript
// ✅ Valid - exactly 56 characters
"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 56 chars

// ❌ Invalid - 55 characters (one below boundary)
"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 55 chars

// ❌ Invalid - 57 characters (one above boundary)
"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 57 chars
```

### Base32 Character Validation

```javascript
// ✅ Valid - all valid base32 characters (A-Z, 2-7)
"GAAAAAAAAAAAAAAAAAAA234567234567234567234567234567234567";

// ❌ Invalid - contains '0'
"G00000000000000000000000000000000000000000000000000000";

// ❌ Invalid - contains '1'
"G11111111111111111111111111111111111111111111111111111";

// ❌ Invalid - contains '8'
"G88888888888888888888888888888888888888888888888888888";

// ❌ Invalid - contains '9'
"G99999999999999999999999999999999999999999999999999999";
```

### Stress Testing

The validation handles extremely large inputs efficiently:

```javascript
// ❌ Invalid - 1 million+ character string is rejected promptly
"G" + "A".repeat(1000000);
```

## Valid Request Example

```http
POST /api/v1/postage/quote HTTP/1.1
Content-Type: application/json

{
  "recipient": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "sender": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
}
```

**Response (200 OK)**:

```json
{
  "data": {
    "amount": "10000000",
    "eligible": true,
    "reason": "mailbox_minimum",
    "trusted": false
  },
  "meta": {
    "requestId": "...",
    "timestamp": "2026-07-19T..."
  }
}
```

## Response Shape Preservation

Valid requests maintain the existing response structure:

```typescript
interface QuoteResponse {
  data: {
    amount: string; // Stroop amount as decimal string
    eligible: boolean; // Whether sender can send to recipient
    reason: "trusted_sender" | "mailbox_minimum" | "sender_blocked";
    trusted: boolean; // Whether sender is on recipient's allow list
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}
```

## Security Considerations

### Input Sanitization

- All addresses are trimmed and normalized to uppercase
- No user input is executed or interpreted as code
- Oversized inputs are rejected before processing
- Type coercion is prevented (strict string validation)

### Deterministic Errors

- Validation errors always return the same HTTP status code (422)
- Error codes are stable and documented (`validation_error`)
- Field-specific errors help clients identify issues
- No sensitive information leaked in error messages

### DoS Prevention

- Extremely large inputs are rejected efficiently
- No exponential backtracking in regex validation
- Bounded string processing (max 56 characters accepted)
- No resource exhaustion from malformed inputs

## Implementation Details

### Schema Definition

```typescript
import { z } from "zod";

const stellarAddressSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^G[A-Z2-7]{55}$/, "Expected a Stellar G-address");

const quoteSchema = z.object({
  recipient: stellarAddressSchema,
  sender: stellarAddressSchema,
});
```

### Error Handling Flow

```
Request → JSON Parse → Schema Validation → Business Logic
                          ↓ (on failure)
                       ZodError
                          ↓
                   normalizeApiError()
                          ↓
                 422 validation_error
```

### Test Coverage

The validation is covered by comprehensive tests:

- **Unit tests**: `tests/unit/api/postage-quote-validation.test.ts` (70+ test cases)
- **Endpoint tests**: `tests/unit/api/postage-quote-endpoint-validation.test.ts` (50+ test cases)
- **Domain tests**: `tests/unit/api/domain.test.ts`

Test categories:

- Empty and whitespace inputs
- Invalid prefixes and lengths
- Invalid character sets
- Type safety (null, undefined, non-string)
- Normalization behavior
- Boundary value analysis
- Stress testing
- Error message clarity

## Client Best Practices

### Pre-validation

Clients should validate addresses before sending requests:

```typescript
function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address.trim().toUpperCase());
}

// Validate before making request
if (!isValidStellarAddress(recipient) || !isValidStellarAddress(sender)) {
  throw new Error("Invalid Stellar address format");
}
```

### Error Handling

```typescript
try {
  const response = await fetch("/api/v1/postage/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient, sender }),
  });

  if (response.status === 422) {
    const error = await response.json();
    console.error("Validation error:", error.error.details);
    // Show field-specific errors to user
    return;
  }

  const quote = await response.json();
  // Process quote...
} catch (error) {
  console.error("Network error:", error);
}
```

### Normalization Awareness

Clients can rely on automatic normalization:

```typescript
// These all work and produce the same result:
const quote1 = await getQuote({
  recipient: "GAAAA...",
  sender: "GBBBB...",
});

const quote2 = await getQuote({
  recipient: "gaaaa...", // lowercase normalized
  sender: "gbbbb...",
});

const quote3 = await getQuote({
  recipient: "  GAAAA...  ", // whitespace trimmed
  sender: "  GBBBB...  ",
});
```

## Related Documentation

- [API Overview](./README.md)
- [Domain Schemas](../../src/server/api/domain.ts)
- [Error Handling](../../src/server/api/errors.ts)
- [Stellar Address Format](https://developers.stellar.org/docs/fundamentals-and-concepts/stellar-data-structures/accounts)

## References

- [Stellar SEP-0005: Key Derivation Methods](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md)
- [Base32 Encoding (RFC 4648)](https://datatracker.ietf.org/doc/html/rfc4648#section-6)
- [Zod Schema Validation](https://zod.dev/)
