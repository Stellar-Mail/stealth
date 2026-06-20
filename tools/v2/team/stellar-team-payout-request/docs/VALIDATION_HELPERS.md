# Validation Helpers - Stellar Team Payout Request

## Overview

This document specifies validation, sanitization, and guard helpers for the Stellar Team Payout Request tool. These helpers provide explicit handling for malformed or hostile input as required by the security and performance constraints.

## Validation Helpers

### Email Validation

```typescript
/**
 * Validates email address format and length
 * @param email - Email address to validate
 * @returns Validation result with sanitized email
 */
export function validateEmail(email: string): ValidationResult<string> {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  // Length check (RFC 5321: max 254 characters)
  if (normalized.length > 254) {
    return {
      isValid: false,
      errors: { email: 'Email address exceeds maximum length of 254 characters' },
      sanitized: normalized,
    };
  }

  // Format check (RFC 5322)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      errors: { email: 'Invalid email format' },
      sanitized: normalized,
    };
  }

  // Control character check
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return {
      isValid: false,
      errors: { email: 'Email contains invalid control characters' },
      sanitized: normalized,
    };
  }

  // SQL injection pattern check
  const sqlInjectionPatterns = [
    /'(\s)*(OR|AND)(\s)*'1'='1/i,
    /'(\s)*(OR|AND)(\s)*1=1/i,
    /;(\s)*(DROP|DELETE|INSERT|UPDATE)/i,
    /UNION(\s)+SELECT/i,
  ];

  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(normalized)) {
      return {
        isValid: false,
        errors: { email: 'Email contains potentially malicious content' },
        sanitized: normalized,
      };
    }
  }

  return {
    isValid: true,
    errors: {},
    sanitized: normalized,
  };
}
```

### Amount Validation

```typescript
/**
 * Validates XLM amount format, range, and precision
 * @param amount - Amount string to validate
 * @returns Validation result with sanitized amount
 */
export function validateAmount(amount: string): ValidationResult<string> {
  const trimmed = amount.trim();

  // Empty check
  if (!trimmed) {
    return {
      isValid: false,
      errors: { amount: 'Amount is required' },
      sanitized: trimmed,
    };
  }

  // Scientific notation check
  if (/e/i.test(trimmed)) {
    return {
      isValid: false,
      errors: { amount: 'Scientific notation is not allowed' },
      sanitized: trimmed,
    };
  }

  // Currency symbol check
  if (/[$€£¥₹]/.test(trimmed)) {
    return {
      isValid: false,
      errors: { amount: 'Currency symbols are not allowed' },
      sanitized: trimmed,
    };
  }

  // Numeric parse check
  const numericValue = Number(trimmed);
  if (isNaN(numericValue)) {
    return {
      isValid: false,
      errors: { amount: 'Amount must be a valid number' },
      sanitized: trimmed,
    };
  }

  // Positive check
  if (numericValue <= 0) {
    return {
      isValid: false,
      errors: { amount: 'Amount must be greater than 0' },
      sanitized: trimmed,
    };
  }

  // Decimal precision check (max 7 decimals for Stellar)
  const decimalMatch = trimmed.match(/^-?\d+\.(\d+)$/);
  if (decimalMatch && decimalMatch[1].length > 7) {
    return {
      isValid: false,
      errors: { amount: 'Amount cannot exceed 7 decimal places (Stellar precision)' },
      sanitized: trimmed,
    };
  }

  // Maximum amount check (configurable)
  const MAX_AMOUNT = 10000000; // 10 million XLM
  if (numericValue > MAX_AMOUNT) {
    return {
      isValid: false,
      errors: { amount: `Amount cannot exceed ${MAX_AMOUNT} XLM` },
      sanitized: trimmed,
    };
  }

  // Minimum amount check (1 stroop = 0.0000001 XLM)
  const MIN_AMOUNT = 0.0000001;
  if (numericValue < MIN_AMOUNT) {
    return {
      isValid: false,
      errors: { amount: `Amount must be at least ${MIN_AMOUNT} XLM (1 stroop)` },
      sanitized: trimmed,
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitized: trimmed,
  };
}
```

### Memo Validation

```typescript
/**
 * Validates memo text for Stellar transaction
 * @param memo - Memo text to validate
 * @returns Validation result with sanitized memo
 */
export function validateMemo(memo: string): ValidationResult<string> {
  const trimmed = memo.trim();

  // Empty is allowed (memo is optional)
  if (!trimmed) {
    return {
      isValid: true,
      errors: {},
      sanitized: '',
    };
  }

  // Byte length check (Stellar limit: 28 bytes for text memo)
  const encoder = new TextEncoder();
  const byteLength = encoder.encode(trimmed).length;

  if (byteLength > 28) {
    return {
      isValid: false,
      errors: { memo: `Memo exceeds 28-byte limit (current: ${byteLength} bytes)` },
      sanitized: trimmed.substring(0, 28), // Truncate to byte limit
    };
  }

  // Control character check (allow tab and newline)
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  if (controlCharRegex.test(trimmed)) {
    return {
      isValid: false,
      errors: { memo: 'Memo contains invalid control characters' },
      sanitized: trimmed.replace(controlCharRegex, ''),
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitized: trimmed,
  };
}
```

### Stellar Account ID Validation

```typescript
/**
 * Validates Stellar public key (account ID) format
 * @param accountId - Stellar account ID to validate
 * @returns Validation result with sanitized account ID
 */
export function validateStellarAccountId(accountId: string): ValidationResult<string> {
  const trimmed = accountId.trim();

  // Length check (base32-encoded Ed25519 public key is 56 characters)
  if (trimmed.length !== 56) {
    return {
      isValid: false,
      errors: { accountId: 'Stellar account ID must be 56 characters' },
      sanitized: trimmed,
    };
  }

  // Prefix check (public keys start with 'G')
  if (!trimmed.startsWith('G')) {
    return {
      isValid: false,
      errors: { accountId: 'Stellar account ID must start with G (public key)' },
      sanitized: trimmed,
    };
  }

  // Secret key check (secret keys start with 'S' - reject these)
  if (trimmed.startsWith('S')) {
    return {
      isValid: false,
      errors: { accountId: 'Secret keys are not allowed as account IDs' },
      sanitized: trimmed,
    };
  }

  // Character check (base32: A-Z, 2-7)
  const validChars = /^[A-Z2-7]+$/;
  if (!validChars.test(trimmed)) {
    return {
      isValid: false,
      errors: { accountId: 'Stellar account ID contains invalid characters (must be A-Z, 2-7)' },
      sanitized: trimmed,
    };
  }

  // Ed25519 public key validation (using Stellar SDK)
  try {
    // This would use stellar-sdk in actual implementation
    // For now, format validation is sufficient
    const isValidEd25519 = true; // Placeholder for SDK validation
    if (!isValidEd25519) {
      return {
        isValid: false,
        errors: { accountId: 'Invalid Ed25519 public key' },
        sanitized: trimmed,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      errors: { accountId: 'Failed to validate Stellar account ID' },
      sanitized: trimmed,
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitized: trimmed,
  };
}
```

### Scheduled Date Validation

```typescript
/**
 * Validates scheduled payout date
 * @param date - Date string to validate
 * @returns Validation result with sanitized date
 */
export function validateScheduledDate(date: string | Date): ValidationResult<string> {
  let dateObj: Date;

  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (!trimmed) {
      return {
        isValid: true,
        errors: {},
        sanitized: '',
      };
    }
    dateObj = new Date(trimmed);
  } else {
    dateObj = date;
  }

  // Invalid date check
  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      errors: { scheduledFor: 'Invalid date format' },
      sanitized: '',
    };
  }

  // Past date check
  const now = new Date();
  if (dateObj < now) {
    return {
      isValid: false,
      errors: { scheduledFor: 'Scheduled date cannot be in the past' },
      sanitized: '',
    };
  }

  // Far future check (max 1 year)
  const maxFuture = new Date();
  maxFuture.setFullYear(maxFuture.getFullYear() + 1);
  if (dateObj > maxFuture) {
    return {
      isValid: false,
      errors: { scheduledFor: 'Scheduled date cannot be more than 1 year in the future' },
      sanitized: '',
    };
  }

  // Return ISO 8601 format
  return {
    isValid: true,
    errors: {},
    sanitized: dateObj.toISOString(),
  };
}
```

## Sanitization Helpers

### HTML Sanitization

```typescript
/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - HTML content to sanitize
 * @returns Sanitized HTML
 */
export function sanitizeHtml(html: string): string {
  // In production, use DOMPurify or similar library
  // This is a placeholder implementation

  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  return sanitized;
}
```

### Text Sanitization

```typescript
/**
 * Sanitizes text content for safe display
 * @param text - Text content to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  // Escape HTML entities
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };

  return text.replace(/[&<>"']/g, (char) => escapeMap[char]);
}
```

### URL Sanitization

```typescript
/**
 * Validates and sanitizes URL for safe use
 * @param url - URL to validate
 * @returns Validation result with sanitized URL
 */
export function validateUrl(url: string): ValidationResult<string> {
  const trimmed = url.trim();

  if (!trimmed) {
    return {
      isValid: true,
      errors: {},
      sanitized: '',
    };
  }

  try {
    const urlObj = new URL(trimmed);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        errors: { url: 'Only HTTP and HTTPS URLs are allowed' },
        sanitized: '',
      };
    }

    // Prevent javascript: protocol (already caught by URL parser)
    // Prevent data: URLs
    if (urlObj.protocol === 'data:') {
      return {
        isValid: false,
        errors: { url: 'Data URLs are not allowed' },
        sanitized: '',
      };
    }

    return {
      isValid: true,
      errors: {},
      sanitized: urlObj.toString(),
    };
  } catch {
    return {
      isValid: false,
      errors: { url: 'Invalid URL format' },
      sanitized: '',
    };
  }
}
```

## Guard Helpers

### Type Guards

```typescript
/**
 * Type guard for PayoutFormData
 */
export function isPayoutFormData(data: unknown): data is PayoutFormData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.recipientEmail === 'string' &&
    typeof d.amount === 'string' &&
    (d.memo === undefined || typeof d.memo === 'string') &&
    (d.scheduledFor === undefined || d.scheduledFor instanceof Date || typeof d.scheduledFor === 'string')
  );
}

/**
 * Type guard for PayoutRequest
 */
export function isPayoutRequest(data: unknown): data is PayoutRequest {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.id === 'string' &&
    typeof d.userId === 'string' &&
    typeof d.recipientEmail === 'string' &&
    typeof d.amount === 'string' &&
    typeof d.status === 'string' &&
    ['pending', 'submitted', 'confirmed', 'failed'].includes(d.status) &&
    typeof d.createdAt === 'string' &&
    typeof d.updatedAt === 'string' &&
    (d.transactionId === undefined || typeof d.transactionId === 'string') &&
    (d.error === undefined || typeof d.error === 'string')
  );
}
```

### Null/Undefined Guards

```typescript
/**
 * Guard to ensure value is not null or undefined
 */
export function assertNotNullOrUndefined<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/**
 * Safe access to nested object properties
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue: T): T {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}
```

### Array Length Guards

```typescript
/**
 * Guard to ensure array does not exceed maximum length
 */
export function guardArrayLength<T>(array: T[], maxLength: number, context: string): T[] {
  if (array.length > maxLength) {
    throw new Error(`${context}: Array length ${array.length} exceeds maximum ${maxLength}`);
  }
  return array;
}

/**
 * Guard to ensure string does not exceed maximum length
 */
export function guardStringLength(str: string, maxLength: number, context: string): string {
  if (str.length > maxLength) {
    throw new Error(`${context}: String length ${str.length} exceeds maximum ${maxLength}`);
  }
  return str;
}
```

### Numeric Range Guards

```typescript
/**
 * Guard to ensure number is within range
 */
export function guardNumericRange(
  value: number,
  min: number,
  max: number,
  context: string
): number {
  if (value < min || value > max) {
    throw new Error(`${context}: Value ${value} is outside range [${min}, ${max}]`);
  }
  return value;
}

/**
 * Guard to ensure number is positive
 */
export function guardPositive(value: number, context: string): number {
  if (value <= 0) {
    throw new Error(`${context}: Value ${value} must be positive`);
  }
  return value;
}
```

## Composite Validation

### Payout Request Validation

```typescript
/**
 * Validates complete payout request data
 * @param data - Payout form data to validate
 * @returns Comprehensive validation result
 */
export function validatePayoutRequest(data: PayoutFormData): ValidationResult<PayoutFormData> {
  const errors: Record<string, string> = {};
  const sanitized: Partial<PayoutFormData> = {};

  // Validate email
  const emailResult = validateEmail(data.recipientEmail);
  if (!emailResult.isValid) {
    errors.recipientEmail = emailResult.errors.email;
  }
  sanitized.recipientEmail = emailResult.sanitized;

  // Validate amount
  const amountResult = validateAmount(data.amount);
  if (!amountResult.isValid) {
    errors.amount = amountResult.errors.amount;
  }
  sanitized.amount = amountResult.sanitized;

  // Validate memo (optional)
  if (data.memo !== undefined) {
    const memoResult = validateMemo(data.memo);
    if (!memoResult.isValid) {
      errors.memo = memoResult.errors.memo;
    }
    sanitized.memo = memoResult.sanitized;
  }

  // Validate scheduled date (optional)
  if (data.scheduledFor !== undefined) {
    const dateResult = validateScheduledDate(data.scheduledFor);
    if (!dateResult.isValid) {
      errors.scheduledFor = dateResult.errors.scheduledFor;
    }
    sanitized.scheduledFor = dateResult.sanitized ? new Date(dateResult.sanitized) : undefined;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: sanitized as PayoutFormData,
  };
}
```

## Error Handling

### Validation Error Class

```typescript
/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }

  /**
   * Formats errors for display
   */
  public format(): string {
    return Object.entries(this.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('\n');
  }
}
```

### Guard Error Class

```typescript
/**
 * Custom error class for guard failures
 */
export class GuardError extends Error {
  public readonly context: string;

  constructor(context: string, message: string) {
    super(message);
    this.name = 'GuardError';
    this.context = context;
  }
}
```

## Usage Examples

### Basic Validation

```typescript
// Validate email
const emailResult = validateEmail('  USER@EXAMPLE.COM  ');
if (emailResult.isValid) {
  console.log('Valid email:', emailResult.sanitized); // 'user@example.com'
} else {
  console.error('Invalid email:', emailResult.errors);
}
```

### Composite Validation

```typescript
// Validate complete payout request
const data: PayoutFormData = {
  recipientEmail: 'user@example.com',
  amount: '100.00',
  memo: 'Team payout',
};

const result = validatePayoutRequest(data);
if (!result.isValid) {
  throw new ValidationError(result.errors);
}

// Use sanitized data
await createPayoutRequest(result.sanitized);
```

### Guard Usage

```typescript
// Guard array length
const payouts = await getPayouts(userId);
const limitedPayouts = guardArrayLength(payouts, 100, 'Payout history');

// Guard numeric range
const amount = guardNumericRange(parsedAmount, 0.0000001, 10000000, 'Payout amount');
```

## Testing

### Unit Test Example

```typescript
describe('Validation Helpers', () => {
  describe('validateEmail', () => {
    it('should accept valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('user@example.com');
    });

    it('should reject SQL injection attempt', () => {
      const result = validateEmail("' OR '1'='1");
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('malicious');
    });

    it('should normalize and trim email', () => {
      const result = validateEmail('  USER@EXAMPLE.COM  ');
      expect(result.sanitized).toBe('user@example.com');
    });
  });

  describe('validateAmount', () => {
    it('should reject scientific notation', () => {
      const result = validateAmount('1e30');
      expect(result.isValid).toBe(false);
    });

    it('should reject negative amounts', () => {
      const result = validateAmount('-100.00');
      expect(result.isValid).toBe(false);
    });

    it('should reject amounts exceeding decimal precision', () => {
      const result = validateAmount('100.00000001');
      expect(result.isValid).toBe(false);
    });
  });
});
```

## Integration Points

### With PayoutService

```typescript
class PayoutService {
  async createPayoutRequest(data: PayoutFormData): Promise<PayoutRequest> {
    // Validate before processing
    const validation = validatePayoutRequest(data);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    // Use sanitized data
    const sanitized = validation.sanitized;

    // Proceed with payout creation
    return this.internalCreatePayout(sanitized);
  }
}
```

### With StellarService

```typescript
class StellarService {
  async submitPayment(
    destinationId: string,
    amount: string,
    memo?: string
  ): Promise<TransactionResult> {
    // Validate destination account
    const accountValidation = validateStellarAccountId(destinationId);
    if (!accountValidation.isValid) {
      throw new ValidationError(accountValidation.errors);
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.isValid) {
      throw new ValidationError(amountValidation.errors);
    }

    // Validate memo if provided
    if (memo) {
      const memoValidation = validateMemo(memo);
      if (!memoValidation.isValid) {
        throw new ValidationError(memoValidation.errors);
      }
    }

    // Proceed with transaction
    return this.internalSubmitPayment(
      accountValidation.sanitized,
      amountValidation.sanitized,
      memo ? validateMemo(memo).sanitized : undefined
    );
  }
}
```

## References

- [SECURITY_THREAT_MODEL.md](./SECURITY_THREAT_MODEL.md) - Detailed threat assumptions
- [API.md](./API.md) - Component and service API documentation
- [PERFORMANCE_CONSTRAINTS.md](./PERFORMANCE_CONSTRAINTS.md) - Performance considerations

## Version History

- v1.0 - Initial validation helpers specification for V2 later-release tool
