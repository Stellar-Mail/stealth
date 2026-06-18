# Team Digest Generator - API Reference

## Input Validation Service

All user input must be validated before processing. Use the `inputValidation` service.

### Email Validation

```typescript
import { validateEmail } from "../services/inputValidation";

// Returns null if valid, or ValidationError if invalid
const error = validateEmail("user@example.com");
if (error) {
  console.error(error.message); // "Invalid email format"
}
```

**Valid email formats:**

- `user@example.com`
- `user+tag@example.com`
- `first.last@sub.example.co.uk`

**Rejected:**

- No `@` symbol
- Exceeds 254 characters
- Control characters
- SQL injection patterns

### Team Member Validation

```typescript
import { validateTeamMember } from "../services/inputValidation";

const member = {
  id: "user-1",
  email: "alice@example.com",
  name: "Alice Smith",
};

const error = validateTeamMember(member);
if (error) {
  // Handle error
}
```

**Requirements:**

- `email`: Valid RFC 5322 format, < 254 chars
- `name`: Non-empty, < 200 chars, no control characters
- `id`: Unique string identifier

### Schedule Expression Validation

```typescript
import { validateScheduleExpression } from "../services/inputValidation";

// Daily schedule
const dailyError = validateScheduleExpression({
  type: "daily",
  value: "09:00", // HH:MM format
  timezone: "America/New_York",
});

// Weekly schedule
const weeklyError = validateScheduleExpression({
  type: "weekly",
  value: "5 14:30", // day (0-6) HH:MM
});

// Cron expression
const cronError = validateScheduleExpression({
  type: "cron",
  value: "0 9 * * 1-5", // minute hour day month weekday
});
```

**Daily schedule:**

- Format: `HH:MM` (24-hour, 00:00-23:59)

**Weekly schedule:**

- Format: `D HH:MM` where D is day 0-6 (0=Sunday)

**Cron expression:**

- 5-field format: `minute hour day month weekday`
- Fields: 0-59, 0-23, 1-31, 1-12, 0-6
- Supports: `*`, ranges (`0-5`), lists (`1,3,5`), steps (`*/5`)
- Max field complexity: 50 characters (prevents ReDoS)

### Digest Configuration Validation

```typescript
import { validateDigestConfig } from "../services/inputValidation";

const config = {
  teamId: "team-1",
  recipients: [
    { id: "user-1", email: "alice@example.com", name: "Alice" },
    { id: "user-2", email: "bob@example.com", name: "Bob" },
  ],
  schedule: {
    type: "daily",
    value: "09:00",
    timezone: "UTC",
  },
  filters: {
    excludeSenders: ["spam@example.com"],
    excludeCategories: ["notifications", "updates"],
  },
};

const result = validateDigestConfig(config);
if (!result.valid) {
  result.errors.forEach((error) => {
    console.error(`${error.field}: ${error.message}`);
  });
}
```

**Configuration limits:**

- Recipients: 1-1000
- Exclusion rules: 0-1000
- Date range: max 90 days

---

## Content Sanitization Service

All email content must be sanitized before display. Use the `contentSanitization` service.

### Email Content Sanitization

```typescript
import { sanitizeEmailContent } from '../services/contentSanitization';

const htmlContent = emailBody;
const safe = sanitizeEmailContent(htmlContent);

// Use safe HTML in UI
return <div dangerouslySetInnerHTML={{ __html: safe }} />;
```

**Removes:**

- Script tags and event handlers
- Iframe, object, embed tags
- Form elements
- Dangerous protocols (javascript:, data:, vbscript:)
- Style attributes (prevents CSS-based attacks)

**Preserves:**

- Safe HTML tags (p, div, span, a, b, i, br, etc.)
- Safe attributes (href with safe protocols, title, id)
- Text content and formatting

### Subject Line Sanitization

```typescript
import { sanitizeEmailSubject } from "../services/contentSanitization";

const subject = "Meeting\x00Scheduled";
const safe = sanitizeEmailSubject(subject);
// Result: 'MeetingScheduled' (control chars removed)
```

**Removes:**

- Control characters (U+0000-U+001F, U+007F-U+009F)
- Null bytes
- Truncates to 500 characters

### Sender Email Sanitization

```typescript
import { sanitizeSenderEmail } from "../services/contentSanitization";

const from = "attacker@example.com  ";
const safe = sanitizeSenderEmail(from);
// Result: 'attacker@example.com' (trimmed, validated)
```

### Filename Sanitization

```typescript
import { sanitizeFilename, validateAttachment } from "../services/contentSanitization";

const attachment = {
  filename: "../../etc/passwd",
  mimeType: "text/plain",
  sizeBytes: 1024,
};

const validated = validateAttachment(attachment);
if (validated.valid) {
  console.log(validated.filename); // 'etc_passwd' (path traversal removed)
  console.log(validated.sizeFormatted); // '1 KB'
} else {
  console.error(validated.error);
}
```

**Filename rules:**

- Removes path components
- Removes null bytes
- Allows only: `[a-zA-Z0-9._\-]`
- Max 255 characters
- Rejects path traversal patterns

**Attachment rules:**

- Max size: 100 MB per file
- No content parsing or downloads
- Metadata only

### HTML Escaping

```typescript
import { escapeHtml } from "../services/contentSanitization";

const userInput = '<script>alert("xss")</script>';
const safe = escapeHtml(userInput);
// Result: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

**Use when:**

- Displaying user-provided text in HTML context
- Building user-generated content
- Constructing HTML attributes

---

## Error Handling

All validation functions return `ValidationError` or `ValidationResult`:

```typescript
interface ValidationError {
  field: string; // Which field failed
  message: string; // User-friendly error message
  code: string; // Machine-readable error code
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

**Common error codes:**

- `REQUIRED` - Field is required
- `INVALID_FORMAT` - Format is invalid
- `MAX_LENGTH_EXCEEDED` - Value too long
- `OUT_OF_BOUNDS` - Value outside valid range
- `INVALID_TYPE` - Wrong data type
- `DUPLICATE` - Duplicate value
- `TOO_MANY_RULES` - Exceeded limit

**Error handling pattern:**

```typescript
try {
  const result = validateDigestConfig(config);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `${e.field}: ${e.message}`);
    return { success: false, errors: errorMessages };
  }

  // Process valid config
  return { success: true };
} catch (err) {
  // Log unexpected errors securely (no sensitive data)
  return { success: false, errors: ["Configuration validation failed"] };
}
```

---

## Performance Recommendations

### Streaming Large Email Sets

```typescript
// BAD: Load all at once
const allEmails = await db.emails.find(query).toArray();
for (const email of allEmails) {
  // Process
}

// GOOD: Stream and process
for await (const email of db.emails.find(query).limit(10000)) {
  const sanitized = sanitizeEmailContent(email.body);
  // Process one at a time
}
```

### Caching Sanitization Results

```typescript
const sanitizationCache = new Map();

function sanitizeWithCache(html: string): string {
  if (sanitizationCache.has(html)) {
    return sanitizationCache.get(html);
  }

  const result = sanitizeEmailContent(html);
  sanitizationCache.set(html, result);

  // Clear cache periodically
  if (sanitizationCache.size > 10000) {
    sanitizationCache.clear();
  }

  return result;
}
```

### Efficient Filtering

```typescript
// BAD: Array includes for each check
for (const email of emails) {
  if (excludedSenders.includes(email.from)) skip(); // O(n) per email
}

// GOOD: Use Set for O(1) lookup
const excluded = new Set(excludedSenders);
for (const email of emails) {
  if (excluded.has(email.from)) skip(); // O(1)
}
```

---

## Integration with Components

### Example: Digest Configuration Component

```typescript
import { validateDigestConfig } from '@/services/inputValidation';
import { useState } from 'react';

export function DigestConfigForm() {
  const [config, setConfig] = useState(initialConfig);
  const [errors, setErrors] = useState([]);

  const handleSave = () => {
    const result = validateDigestConfig(config);

    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    // All validation passed, save config
    saveDigestConfig(config);
  };

  return (
    <form onSubmit={handleSave}>
      {/* Form fields */}
      {errors.map(err => (
        <p key={err.field} className="error">
          {err.field}: {err.message}
        </p>
      ))}
    </form>
  );
}
```

### Example: Digest Preview Component

```typescript
import { sanitizeEmailContent, sanitizeEmailSubject } from '@/services/contentSanitization';

export function DigestPreview({ emails }) {
  return (
    <div>
      {emails.map(email => (
        <div key={email.id} className="email-preview">
          <h3>{sanitizeEmailSubject(email.subject)}</h3>
          <p className="from">{email.from}</p>
          <div
            className="content"
            dangerouslySetInnerHTML={{
              __html: sanitizeEmailContent(email.snippet),
            }}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## Testing

See [security.example.test.ts](../tests/security.example.test.ts) for comprehensive test examples covering:

- Input validation with malformed data
- XSS prevention
- Control character removal
- Attachment validation
- Performance benchmarks
- Large dataset handling

---

## Security Checklist

Before deploying any digest feature:

- [ ] All user input validated using inputValidation service
- [ ] All email content sanitized using contentSanitization service
- [ ] Error messages are generic (no sensitive data)
- [ ] Resource limits enforced (email count, recipient count, etc.)
- [ ] No sensitive data in logs
- [ ] Tests pass, including security tests
- [ ] Code reviewed for injection vulnerabilities

---

## Next Steps

1. Review [THREAT_MODEL.md](./THREAT_MODEL.md) for security assumptions
2. Review [PERFORMANCE.md](./PERFORMANCE.md) for performance constraints
3. Implement components using validation and sanitization services
4. Add tests based on [security.example.test.ts](../tests/security.example.test.ts)
5. Deploy with security review sign-off
