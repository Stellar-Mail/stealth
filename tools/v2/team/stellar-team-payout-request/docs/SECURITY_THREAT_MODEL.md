# Security Threat Model - Stellar Team Payout Request

## Overview

This document outlines threat assumptions, unsafe inputs, and security considerations for the Stellar Team Payout Request tool. This is a V2 later-release tool that operates in isolation from the main application.

## Threat Assumptions

### Attacker Model

We assume the following threat actors and capabilities:

**External Attackers**
- Can access the tool through the web interface
- Can manipulate HTTP requests and responses
- Can inject malicious data into form fields
- Can attempt to exploit client-side validation bypasses
- Cannot access server-side secrets or environment variables

**Malicious Internal Users**
- Are authenticated team members with valid access
- May attempt to exceed payout limits
- May attempt to route funds to unauthorized accounts
- Cannot modify the tool's code or configuration
- Cannot access other users' payout requests

**Compromised Network**
- Network traffic may be intercepted
- Stellar Horizon API responses may be tampered with
- DNS resolution may be poisoned

## Unsafe Inputs

### User-Supplied Data

#### 1. Recipient Email

**Threats:**
- Email format injection attacks
- Excessively long email addresses causing buffer overflows
- Unicode normalization attacks
- Email header injection via malformed addresses

**Validation Requirements:**
```typescript
// Maximum length: 254 characters (RFC 5321)
// Must match RFC 5322 email format
// Must not contain control characters
// Must be normalized to lowercase
// Must be trimmed of whitespace
```

**Attack Examples:**
```
malicious@example.com" OR "1"="1"
very.long.email.address.that.exceeds.maximum.allowed.length@domain.com
attacker@example.com\r\nBcc: victim@example.com
```

#### 2. Payout Amount

**Threats:**
- Numeric overflow/underflow attacks
- Scientific notation injection
- Currency symbol injection
- Negative amount attacks
- Extremely large precision attacks

**Validation Requirements:**
```typescript
// Must be parseable as decimal number
// Must be > 0
// Maximum: 10,000,000 XLM (configurable)
// Minimum: 0.0000001 XLM (1 stroop)
// Maximum decimal places: 7 (Stellar precision)
// Must not use scientific notation
// Must not include currency symbols
```

**Attack Examples:**
```
999999999999999999999999999999999999999
1e30
-100.00
$100.00
0.00000001 (8 decimals - exceeds precision)
```

#### 3. Memo Field

**Threats:**
- Memo length overflow (Stellar limit: 28 bytes for text memo)
- XSS injection via memo text
- SQL injection (if memo is logged to database)
- Unicode encoding attacks
- Control character injection

**Validation Requirements:**
```typescript
// Maximum: 28 bytes (Stellar text memo limit)
// Must be UTF-8 encoded
// Must not contain control characters (except tab, newline)
// Must be sanitized for XSS if displayed
// Must be truncated if exceeds byte limit
```

**Attack Examples:**
```
<script>alert('XSS')</script>
A memo that exceeds the 28 byte limit when encoded in UTF-8
\x00\x01\x02 (control characters)
```

#### 4. Stellar Account ID (Public Key)

**Threats:**
- Invalid public key format causing service crashes
- Malformed Ed25519 public keys
- Base64 encoding attacks
- Confusion between secret keys and public keys

**Validation Requirements:**
```typescript
// Must be 56 characters (base32-encoded Ed25519 public key)
// Must start with 'G'
// Must only contain A-Z and digits 2-7
// Must be valid Ed25519 public key
// Must not be a secret key (starts with 'S')
```

**Attack Examples:**
```
SAB... (secret key, not public key)
INVALID_PUBLIC_KEY_FORMAT
G1234567890 (too short)
GABCDEFGHIJKLMNOPQRSTUVWXYZ234567 (invalid characters)
```

#### 5. Scheduled Date

**Threats:**
- Date format injection
- Far-future date attacks
- Past date attacks
- Time zone manipulation attacks

**Validation Requirements:**
```typescript
// Must be valid ISO 8601 date
// Must not be in the past
// Maximum: 1 year in the future (configurable)
// Must be parsed in UTC
```

**Attack Examples:**
```
9999-12-31 (far future)
2020-01-01 (past date)
invalid-date-format
```

### External API Responses

#### 1. Stellar Horizon API

**Threats:**
- Malformed JSON responses
- Unexpected response structure
- Extremely large responses causing memory issues
- Delayed responses causing timeouts
- Error message injection

**Validation Requirements:**
```typescript
// Validate response structure before parsing
// Limit response size to 1MB
// Implement request timeouts (30s default)
// Sanitize error messages before display
// Verify network passphrase matches expected
```

#### 2. Network Responses

**Threats:**
- DNS rebinding attacks
- SSL/TLS certificate spoofing
- Man-in-the-middle attacks
- Response splitting attacks

**Validation Requirements:**
```typescript
// Use HTTPS only
// Validate SSL certificates
// Pin Stellar Horizon server certificates
// Verify response Content-Type
// Validate response origin
```

## Security Controls

### Input Validation

#### Client-Side Validation
```typescript
// Immediate feedback for user experience
// Can be bypassed - never trust client-side validation alone
// Used for UX, not security

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: T;
}
```

#### Server-Side Validation
```typescript
// Always validate on server before processing
// Cannot be bypassed by client manipulation
// Must be the authoritative validation source

function validatePayoutRequest(data: PayoutFormData): ValidationResult {
  // 1. Validate email format and length
  // 2. Validate amount range and precision
  // 3. Validate memo length and encoding
  // 4. Validate Stellar account ID format
  // 5. Validate scheduled date range
  // 6. Return sanitized data
}
```

### Output Sanitization

#### Display Sanitization
```typescript
// All user-generated content must be sanitized before display
// Use DOMPurify or similar for HTML content
// Escape HTML entities in text content
// Validate URLs before rendering links
```

#### Logging Sanitization
```typescript
// Never log sensitive data (secret keys, full account IDs)
// Sanitize error messages before logging
// Truncate long values in logs
// Mask personally identifiable information
```

### Rate Limiting

```typescript
// Prevent brute force attacks
// Limit payout requests per user per hour
// Limit Stellar API calls per minute
// Implement exponential backoff for retries

const RATE_LIMITS = {
  payoutRequestsPerHour: 10,
  stellarApiCallsPerMinute: 60,
  maxRetries: 3,
  retryDelayMs: 1000,
};
```

### Authentication and Authorization

```typescript
// All payout operations require authentication
// Users can only access their own payout requests
// Team admins can view team payout history
// No cross-user data access allowed

interface PayoutRequest {
  id: string;
  userId: string; // Owner of the request
  // ... other fields
}

// Authorization check before access
function canAccessPayout(request: PayoutRequest, userId: string): boolean {
  return request.userId === userId || isAdmin(userId);
}
```

### Cryptographic Security

```typescript
// Stellar secret keys must never be exposed to client
// Use secure key management in production (AWS KMS, HashiCorp Vault)
// Never log or transmit secret keys
// Use testnet keys for development only

// Keypair handling
const keypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);
// Secret key never leaves server memory
// Only public key is exposed to client
```

## Known Vulnerabilities and Mitigations

### 1. Client-Side Validation Bypass

**Vulnerability:** Attackers can bypass client-side validation by sending direct API requests.

**Mitigation:**
- Always validate on server-side
- Treat client-side validation as UX enhancement only
- Implement server-side validation as authoritative source

### 2. XSS via Memo Display

**Vulnerability:** Malicious memos can contain script tags that execute when displayed.

**Mitigation:**
- Sanitize all memo content before display
- Use DOMPurify or similar library
- Escape HTML entities in text content
- Consider displaying memos as plain text only

### 3. CSRF Attacks

**Vulnerability:** Attackers can trick users into submitting payout requests.

**Mitigation:**
- Implement CSRF tokens for all state-changing operations
- Validate Origin and Referer headers
- Use SameSite cookie attributes
- Require re-authentication for large payouts

### 4. Replay Attacks

**Vulnerability:** Attackers can replay valid payout requests.

**Mitigation:**
- Use unique transaction IDs for each payout
- Implement nonce or timestamp validation
- Stellar transactions include sequence numbers to prevent replay

### 5. Stellar Network Attacks

**Vulnerability:** Compromised Stellar Horizon servers or network.

**Mitigation:**
- Verify network passphrase before signing transactions
- Use official Stellar Horizon servers
- Implement certificate pinning
- Validate transaction results before confirming

## Security Testing Requirements

### Unit Tests

```typescript
// Test validation functions with malicious inputs
describe('Validation Security', () => {
  it('should reject email with SQL injection', () => {
    expect(validateEmail("' OR '1'='1")).toBe(false);
  });

  it('should reject amount with scientific notation', () => {
    expect(validateAmount('1e30')).toBe(false);
  });

  it('should reject memo with XSS payload', () => {
    expect(validateMemo('<script>alert(1)</script>')).toBe(false);
  });

  it('should reject invalid Stellar public key', () => {
    expect(validateStellarAccountId('INVALID')).toBe(false);
  });
});
```

### Integration Tests

```typescript
// Test end-to-end security controls
describe('Security Integration', () => {
  it('should sanitize user input before storage', async () => {
    const result = await createPayoutRequest({
      recipientEmail: '  user@example.com  ',
      amount: '100.00',
    });
    expect(result.recipientEmail).toBe('user@example.com');
  });

  it('should prevent cross-user access', async () => {
    const request = await createPayoutRequest(mockData);
    await expect(
      getPayoutById(request.id, 'other-user-id')
    ).rejects.toThrow('Unauthorized');
  });
});
```

### Security Checklist

Before deployment, verify:

- [ ] All user inputs are validated on server-side
- [ ] All outputs are sanitized before display
- [ ] Rate limiting is implemented and tested
- [ ] Authentication is required for all operations
- [ ] Authorization checks prevent cross-user access
- [ ] Secret keys are never exposed to client
- [ ] HTTPS is enforced for all network requests
- [ ] CSRF protection is implemented
- [ ] Error messages do not leak sensitive information
- [ ] Logging does not include sensitive data
- [ ] Stellar network passphrase is validated
- [ ] Input length limits are enforced
- [ ] File size limits are enforced (if attachments added)

## Incident Response

### Security Incident Types

1. **Unauthorized Payout Attempts**
   - Monitor for unusual payout patterns
   - Alert on multiple failed attempts
   - Lock accounts after threshold

2. **Stellar Key Compromise**
   - Rotate compromised keys immediately
   - Revoke pending transactions
   - Audit affected payout requests

3. **Data Exfiltration**
   - Monitor access logs
   - Alert on bulk data access
   - Implement data access audit trails

### Reporting

Report security issues to:
- Internal security team
- Project maintainers
- Stellar security team (if network-related)

## References

- [Stellar Security Best Practices](https://developers.stellar.org/docs/security/)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
- [Stellar Memo Limits](https://developers.stellar.org/docs/encyclopedia/transactions-memos/)

## Version History

- v1.0 - Initial threat model for V2 later-release tool
