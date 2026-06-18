# Team Digest Generator - Threat Model

## Overview

This document defines threat assumptions, unsafe inputs, and mitigation strategies for the Team Digest Generator tool.

---

## Threat Assumptions

### What We Assume Is Unsafe

1. **User Input**
   - Team member email addresses and names (unvalidated)
   - Schedule expressions (cron or custom format)
   - Filter rules and exclusion lists
   - Configuration from untrusted sources

2. **Email Content**
   - Subject lines from any sender
   - Email bodies (HTML, rich text, plain text)
   - Attachments (filenames, metadata)
   - Headers and sender information

3. **Team Membership Data**
   - Membership lists from external sources
   - Permission/role information
   - Team identifiers

### What We Assume Is Safe (Trusted)

- Main app authentication system (verified by main app)
- Digest configuration stored in app database (assumed verified at storage time)
- Stellar blockchain data (assumed immutable from blockchain)
- System time and timezone data

---

## Input Validation Rules

### Team Member Email Addresses

**Threat:** Email address injection, header injection, command injection

**Validation:**

```typescript
- Must match RFC 5322 email format
- Length < 254 characters
- No special characters except: . + - _
- Domain must have valid TLD
- Sanitize before any logging or display
```

**Implementation:**

```typescript
function validateEmail(email: string): ValidationError | null {
  const maxLength = 254;
  const rfc5322 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || email.length > maxLength) {
    return { field: "email", message: "Invalid email length", code: "INVALID_LENGTH" };
  }

  if (!rfc5322.test(email.trim())) {
    return { field: "email", message: "Invalid email format", code: "INVALID_FORMAT" };
  }

  return null;
}
```

### Team Member Names

**Threat:** XSS through stored names, command injection in display

**Validation:**

```typescript
- Length < 200 characters
- No control characters (U+0000 to U+001F, U+007F to U+009F)
- No null bytes
- Trim whitespace
```

**Implementation:**

```typescript
function sanitizeTeamMemberName(name: string): string {
  // Remove control characters
  let sanitized = name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
  // Trim whitespace
  sanitized = sanitized.trim();
  // Max length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  return sanitized;
}
```

### Schedule Expressions

**Threat:** ReDoS (Regular Expression Denial of Service), infinite loops, resource exhaustion

**Validation:**

```typescript
- If daily: time must be HH:MM format (00:00-23:59)
- If weekly: day 0-6, time HH:MM format
- If cron: must be valid 5-field cron expression
- Cron field values: minute (0-59), hour (0-23), day (1-31), month (1-12), weekday (0-6)
- No wildcard ranges that span > 24 hours for any single cron field
- Timezone must be in IANA timezone list
```

**Implementation:**

```typescript
function validateScheduleExpression(schedule: ScheduleExpression): ValidationError | null {
  const { type, value, timezone } = schedule;

  // Validate timezone if provided
  if (timezone && !isValidTimezone(timezone)) {
    return { field: "timezone", message: "Invalid timezone", code: "INVALID_TIMEZONE" };
  }

  if (type === "daily") {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(value)) {
      return { field: "schedule", message: "Invalid daily time format", code: "INVALID_TIME" };
    }
  } else if (type === "weekly") {
    const weeklyRegex = /^[0-6]\s([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!weeklyRegex.test(value)) {
      return { field: "schedule", message: "Invalid weekly format", code: "INVALID_WEEKLY" };
    }
  } else if (type === "cron") {
    const cronError = validateCronExpression(value);
    if (cronError) return cronError;
  }

  return null;
}

function validateCronExpression(cron: string): ValidationError | null {
  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) {
    return { field: "schedule", message: "Cron must have 5 fields", code: "INVALID_CRON" };
  }

  const [minute, hour, day, month, weekday] = parts;

  // Prevent ReDoS by checking part length
  if (parts.some((p) => p.length > 50)) {
    return { field: "schedule", message: "Cron field too complex", code: "CRON_TOO_COMPLEX" };
  }

  const ranges = [
    { field: minute, min: 0, max: 59, name: "minute" },
    { field: hour, min: 0, max: 23, name: "hour" },
    { field: day, min: 1, max: 31, name: "day" },
    { field: month, min: 1, max: 12, name: "month" },
    { field: weekday, min: 0, max: 6, name: "weekday" },
  ];

  for (const { field, min, max, name } of ranges) {
    if (!isValidCronField(field, min, max)) {
      return { field: "schedule", message: `Invalid cron ${name}`, code: "INVALID_CRON_FIELD" };
    }
  }

  return null;
}
```

### Filter Rules (Exclusions)

**Threat:** Injection attacks in filter patterns, memory exhaustion from large exclusion lists

**Validation:**

```typescript
- Max 1000 exclusion rules per digest
- Each rule max 500 characters
- No regex patterns (use exact string matching only)
- No wildcard expansion that causes exponential matching
```

**Implementation:**

```typescript
function validateFilterRules(filters: DigestFilters): ValidationError | null {
  if (filters.excludeSenders) {
    if (filters.excludeSenders.length > 1000) {
      return {
        field: "excludeSenders",
        message: "Too many exclusion rules",
        code: "TOO_MANY_RULES",
      };
    }
    for (const sender of filters.excludeSenders) {
      if (sender.length > 500) {
        return { field: "excludeSenders", message: "Rule too long", code: "RULE_TOO_LONG" };
      }
      const err = validateEmail(sender);
      if (err) return err;
    }
  }
  return null;
}
```

---

## Email Content Sanitization

### HTML Content Sanitization

**Threat:** XSS, malicious scripts, phishing content, browser exploits

**Sanitization Rules:**

```typescript
- Remove all <script>, <iframe>, <object>, <embed> tags
- Remove event handlers (onclick, onerror, onload, etc.)
- Remove dangerous protocols (javascript:, data:, vbscript:)
- Allow safe tags only: <p>, <div>, <span>, <a>, <br>, <b>, <i>, <u>, <strong>, <em>
- Whitelist attributes: href, class, id, title (sanitized)
- Strip style attributes or run through CSS sanitizer
- Remove form elements (<form>, <input>, <button>)
- Escape mailto: and other schemes carefully
```

**Implementation:**

```typescript
function sanitizeEmailContent(html: string): string {
  // Remove dangerous tags
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*>/gi, "");

  // Remove event handlers
  sanitized = sanitized
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove dangerous protocols
  sanitized = sanitized.replace(/href\s*=\s*["']?(?:javascript|data|vbscript):/gi, 'href="#"');

  // Remove style attributes to prevent CSS-based attacks
  sanitized = sanitized.replace(/\s*style\s*=\s*["'][^"']*["']/gi, "");

  return sanitized;
}
```

### Subject Line Sanitization

**Threat:** Injection attacks, encoding attacks, control characters

**Sanitization Rules:**

```typescript
- Remove control characters (U+0000 to U+001F, U+007F to U+009F)
- Remove null bytes
- Decode MIME-encoded words safely
- Truncate to 500 characters
- Escape for display context (HTML, JSON, logs)
```

**Implementation:**

```typescript
function sanitizeEmailSubject(subject: string): string {
  // Remove control characters
  let sanitized = subject.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Safely decode MIME-encoded words
  try {
    sanitized = decodeMimeWord(sanitized);
  } catch {
    // If decoding fails, use original
  }

  // Truncate
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  return sanitized;
}
```

### Attachment Handling

**Threat:** Malware delivery, zip bombs, path traversal, code execution

**Validation Rules:**

```typescript
- Filename must be < 255 characters
- Filename must match [a-zA-Z0-9._\-] pattern
- No path traversal patterns (.., /, \)
- File size must be checked (max 100MB per file)
- MIME type must be verified against filename
- Do NOT execute or parse attachment content
- Do NOT store attachment data
```

**Implementation:**

```typescript
function validateAttachment(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): ValidationError | null {
  // Check length
  if (!filename || filename.length > 255) {
    return {
      field: "attachment",
      message: "Invalid filename length",
      code: "INVALID_FILENAME_LENGTH",
    };
  }

  // Check for path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return { field: "attachment", message: "Invalid filename format", code: "PATH_TRAVERSAL" };
  }

  // Check allowed characters
  if (!/^[a-zA-Z0-9._\-]+$/.test(filename)) {
    return {
      field: "attachment",
      message: "Filename contains invalid characters",
      code: "INVALID_CHARACTERS",
    };
  }

  // Check size
  if (sizeBytes > 100 * 1024 * 1024) {
    return { field: "attachment", message: "File too large", code: "FILE_TOO_LARGE" };
  }

  return null;
}
```

---

## Mitigation Strategies

### 1. Input Validation at Boundaries

- Validate all user input when digest configuration is created/updated
- Validate email content when ingested from mail service
- Validate schedule expressions before storing

### 2. Output Encoding

- HTML-encode all user content when rendering
- JSON-encode when serializing
- URL-encode when building URLs

### 3. Error Handling

- Never expose system internals in error messages
- Log validation failures securely (no sensitive data)
- Return generic error messages to client
- Log detailed errors server-side for debugging

### 4. Resource Limits

- Max 1000 recipients per digest
- Max 10,000 emails per digest
- Max 1000 exclusion rules
- Process timeout: 30 seconds per digest
- Memory limit: 500MB per digest operation

### 5. Logging

- Log validation failures with timestamp
- Never log email content, passwords, or tokens
- Log configuration changes with user ID
- Rotate logs regularly

### 6. Dependency Security

- Only use trusted sanitization libraries
- Keep dependencies up to date
- Audit transitive dependencies quarterly

---

## Security Review Checklist

Before considering a digest feature complete:

- [ ] All user inputs validated
- [ ] Email content sanitized
- [ ] No sensitive data in logs
- [ ] Error messages are generic
- [ ] Resource limits enforced
- [ ] Dependencies are current
- [ ] Security tests pass
- [ ] Code review completed by security reviewer

---

## Incident Response

If a security issue is discovered:

1. Disable affected feature immediately
2. Log incident details
3. Notify users if data may be compromised
4. Add test case to prevent regression
5. Document fix in this threat model
6. Add validation/guard to prevent future occurrence

---

## Future Considerations

When integrating with main app:

- Ensure authentication checks
- Verify user has permission to modify digest
- Audit trail for configuration changes
- Rate limiting on digest generation
- Additional isolation mechanisms if needed
