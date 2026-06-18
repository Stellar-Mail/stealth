# Team Task Board from Emails - Threat Model

## Document Purpose

This document identifies threat assumptions, attack vectors, and unsafe inputs for the Team Task Board from Emails tool. It serves as the foundation for security requirements and defensive implementation.

## Threat Assumptions

### Assumption 1: Untrusted Email Sources

**Description:** All email input is treated as potentially hostile and originating from untrusted sources.

**Rationale:**

- Email can be forged, spoofed, or crafted by attackers
- Legitimate users' accounts may be compromised
- Email content may transit through untrusted intermediaries

**Mitigation:**

- Multi-layer validation (structure → content → semantics)
- Content sanitization before storage or display
- Suspicious pattern detection and review flagging

### Assumption 2: Malformed Input is Common

**Description:** Email data frequently arrives in malformed, incomplete, or non-standard formats.

**Rationale:**

- Email clients have varying RFC 5322 compliance levels
- Encoding issues during transit
- Legacy systems may produce non-standard formats

**Mitigation:**

- Strict input validation with clear error messages
- Graceful degradation for minor format violations
- Comprehensive error logging for audit

### Assumption 3: Attachments are Hostile

**Description:** Email attachments are potential vectors for malware, exploits, or resource exhaustion.

**Rationale:**

- Attachments can contain executable code
- Compressed archives can be zip bombs
- Large attachments can exhaust memory or disk

**Mitigation:**

- Strict file type and size restrictions
- Executable extension blocking
- Zip bomb detection via compression ratio analysis
- MIME type validation

### Assumption 4: Resource Exhaustion is Intentional

**Description:** Attackers may deliberately craft emails or threads to exhaust computational resources.

**Rationale:**

- Large email bodies or threads can cause memory exhaustion
- Complex regex patterns can trigger ReDoS attacks
- Deep thread nesting can cause stack overflows

**Mitigation:**

- Strict size, time, and memory limits
- ReDoS-safe regex patterns with backtracking limits
- Thread depth restrictions
- Timeout guards on all processing operations

## Attack Vectors

### Vector 1: Cross-Site Scripting (XSS)

**Description:** Injection of malicious scripts via email content that execute in user browsers.

**Attack Scenarios:**

1. `<script>` tags in email body
2. JavaScript protocol URLs (`javascript:alert(1)`)
3. Event handlers in HTML attributes (`onclick=...`)
4. Data URIs containing scripts (`data:text/html,<script>...`)
5. HTML entity encoding obfuscation (`&lt;script&gt;`)

**Defensive Layers:**

1. **Validation**: Detect and reject emails with script-like patterns
2. **Sanitization**: Strip all HTML tags, script tags, event handlers, dangerous protocols
3. **Encoding**: Proper output encoding when displaying content
4. **CSP**: Content Security Policy headers (integration phase)

**Testing:**

- XSS payloads from OWASP XSS cheat sheet
- Obfuscated script tags
- Context-specific injection attempts

### Vector 2: SQL Injection

**Description:** Injection of SQL commands via email content that could manipulate database queries.

**Attack Scenarios:**

1. Single quotes in task titles or descriptions (`'; DROP TABLE--`)
2. UNION-based injection in extracted fields
3. Boolean-based blind injection in search queries

**Defensive Layers:**

1. **Sanitization**: Escape SQL special characters (`'`, `"`, `\`)
2. **Parameterization**: Use parameterized queries (integration phase)
3. **Input validation**: Reject inputs with SQL-like patterns in unexpected contexts

**Testing:**

- SQLMap payloads
- Single and double quote injection
- Comment sequence injection (`--`, `/*`)

### Vector 3: ReDoS (Regular Expression Denial of Service)

**Description:** Crafted input that causes excessive backtracking in regex patterns, consuming CPU.

**Attack Scenarios:**

1. Catastrophic backtracking patterns (e.g., `(a+)+b` against `aaaa...c`)
2. Nested quantifiers with alternation
3. Large input strings with repetitive patterns

**Defensive Layers:**

1. **Regex limits**: Maximum 10,000 backtracking steps
2. **Timeouts**: 100ms timeout on regex execution
3. **Safe patterns**: Use atomic groups and possessive quantifiers
4. **Input limits**: Maximum string lengths for regex matching

**Testing:**

- Known ReDoS patterns from OWASP
- Fuzzing with long repetitive strings
- Nested quantifier combinations

### Vector 4: Zip Bomb / Decompression Bomb

**Description:** Highly compressed archives that expand to enormous sizes, exhausting memory or disk.

**Attack Scenarios:**

1. Nested zip files (42.zip pattern)
2. High compression ratios (1 KB → 100 MB)
3. Archives with thousands of small files

**Defensive Layers:**

1. **Size limits**: 25 MB per attachment, 100 MB total
2. **Compression ratio check**: Reject ratios above 100:1
3. **File count limit**: Maximum 100 files per archive
4. **Streaming decompression**: Decompress incrementally with size tracking

**Testing:**

- Known zip bomb samples (42.zip)
- Archives with increasing compression ratios
- Large file count archives

### Vector 5: Email Address Spoofing

**Description:** Forged email addresses to impersonate legitimate users or bypass validation.

**Attack Scenarios:**

1. Display name spoofing (`"Admin <attacker@evil.com>"`)
2. Look-alike domains (homograph attacks: `аdmin@company.com` with Cyrillic 'a')
3. Comment injection in email addresses (`admin@company.com(injected)`)
4. Null byte injection in addresses (`admin@company.com\x00@evil.com`)

**Defensive Layers:**

1. **Strict RFC 5322 validation**: Regex-based format checking
2. **Null byte rejection**: Explicit null byte detection
3. **Domain blocklist**: Known malicious domains
4. **Unicode normalization**: Detect homograph attacks (future)

**Testing:**

- Null byte injection attempts
- Homograph domain variations
- RFC 5322 edge cases

### Vector 6: Thread Structure Manipulation

**Description:** Crafted thread relationships that create circular references or excessive depth.

**Attack Scenarios:**

1. Circular thread references (A → B → A)
2. Extremely deep threads (>50 levels)
3. Thread bombs (exponential branching)
4. Timestamp manipulation to break chronology

**Defensive Layers:**

1. **Circular detection**: Track visited emails during traversal
2. **Depth limits**: Maximum 50 levels
3. **Size limits**: Maximum 500 emails per thread
4. **Chronology validation**: Flag timestamp violations

**Testing:**

- Manually crafted circular structures
- Deep nesting tests
- Timestamp ordering violations

### Vector 7: Unicode Exploits

**Description:** Malicious Unicode characters that cause display corruption or spoofing.

**Attack Scenarios:**

1. Right-to-left override (U+202E) to reverse text display
2. Zero-width characters to hide content
3. Bidirectional text override for visual spoofing
4. Combining characters to create display overlays

**Defensive Layers:**

1. **Unicode filtering**: Remove bidirectional override characters (U+202A-U+202E)
2. **Zero-width removal**: Strip U+200B-U+200D, U+FEFF
3. **Format character removal**: Strip U+2060-U+206F
4. **Visual validation**: Display warnings for suspicious Unicode

**Testing:**

- Right-to-left override in filenames
- Zero-width character injection
- Combining character sequences

### Vector 8: Memory Exhaustion

**Description:** Crafted emails that consume excessive memory during processing.

**Attack Scenarios:**

1. Extremely large email bodies (>5 MB)
2. Large numbers of attachments
3. Deep object nesting in metadata
4. Repetitive pattern matching

**Defensive Layers:**

1. **Size limits**: 5 MB body, 50 MB per email processing
2. **Streaming**: Process large bodies in chunks
3. **Memory monitoring**: Track usage and halt if exceeded
4. **Batch limits**: Maximum 1000 emails per batch, 500 MB total

**Testing:**

- Large email bodies (1 MB, 5 MB, 10 MB)
- Multiple large attachments
- High email volume batches

## Unsafe Input Categories

### Category 1: Oversized Content

**Examples:**

- Email body: 10 MB plain text
- Subject line: 5000 characters
- Attachment: 100 MB file
- Thread: 1000 emails

**Danger:**

- Memory exhaustion
- Processing timeouts
- Denial of service

**Detection:**

- Size validation before processing
- Content-Length header checks

### Category 2: Malicious Code

**Examples:**

- `<script>alert(document.cookie)</script>`
- `javascript:void(eval('...'))`
- `<img src=x onerror=alert(1)>`
- `<iframe src="http://evil.com">`

**Danger:**

- XSS attacks
- Session hijacking
- Phishing

**Detection:**

- Pattern matching for script tags
- Protocol detection (javascript:, data:)
- HTML tag stripping

### Category 3: Injection Payloads

**Examples:**

- `'; DROP TABLE users--`
- `" OR 1=1--`
- `${system('rm -rf /')}`
- `../../etc/passwd`

**Danger:**

- SQL injection
- Command injection
- Path traversal

**Detection:**

- SQL special character escaping
- Command delimiter detection
- Path separator validation

### Category 4: Obfuscated Content

**Examples:**

- HTML entity encoding: `&lt;script&gt;`
- URL encoding: `%3Cscript%3E`
- Unicode escapes: `\u003Cscript\u003E`
- Base64 encoded scripts

**Danger:**

- Bypass validation filters
- Hidden malicious content

**Detection:**

- Multi-pass sanitization (decode then sanitize)
- Encoding normalization

### Category 5: Resource Exhaustion Patterns

**Examples:**

- Regex: `(a+)+b` with input `aaaa...c`
- Archive: 1 KB zip → 1 GB uncompressed
- Thread: 50+ level deep nesting
- Body: Millions of repeated characters

**Danger:**

- ReDoS attacks
- Zip bombs
- Stack overflow
- CPU/memory exhaustion

**Detection:**

- Regex backtracking limits
- Compression ratio checks
- Depth limit enforcement
- Pattern-based detection

### Category 6: Spoofed Identifiers

**Examples:**

- Email: `admin@company.com\x00@evil.com`
- Team member: `../../admin`
- Thread ID: `<script>alert(1)</script>`
- File name: `invoice.pdf.exe`

**Danger:**

- Identity spoofing
- Path traversal
- Privilege escalation

**Detection:**

- Strict format validation
- Null byte detection
- Reserved keyword blocking
- Extension validation

## Security Testing Requirements

### Test Suite 1: Input Validation

- [ ] All required fields missing
- [ ] Each required field individually missing
- [ ] Null/undefined values in fields
- [ ] Empty strings in required fields
- [ ] Oversized field values (10x limits)
- [ ] Invalid format values (wrong types)

### Test Suite 2: Sanitization

- [ ] XSS payload suite (OWASP top 25)
- [ ] SQL injection payloads
- [ ] HTML tag combinations
- [ ] JavaScript protocol URLs
- [ ] Data URIs with scripts
- [ ] Event handler attributes
- [ ] Null byte injection
- [ ] Control character injection
- [ ] Unicode bidirectional text

### Test Suite 3: Performance

- [ ] Large email bodies (1MB, 5MB, 10MB)
- [ ] Large attachment counts (10, 50, 100)
- [ ] Deep thread nesting (25, 50, 75 levels)
- [ ] High email volume (100, 500, 1000 per batch)
- [ ] ReDoS patterns
- [ ] Concurrent processing limits

### Test Suite 4: Attachments

- [ ] Executable extensions (.exe, .sh, etc.)
- [ ] Double extensions (.pdf.exe)
- [ ] Oversized files (30MB, 50MB, 100MB)
- [ ] Zip bombs (known samples)
- [ ] Archives with 100+ files
- [ ] MIME type mismatches
- [ ] Null bytes in filenames

### Test Suite 5: Edge Cases

- [ ] Circular thread references
- [ ] Future timestamps (>24 hours)
- [ ] Past timestamps (1970-01-01)
- [ ] Extremely long email chains
- [ ] Multiple recipients (100+)
- [ ] Malformed email addresses
- [ ] Reserved team member IDs

## Monitoring and Logging

### Security Event Logging

All security-relevant events SHALL be logged with:

- Timestamp (ISO 8601)
- Event type (validation_failure, sanitization, suspicious_pattern)
- Severity (info, warning, error, critical)
- Email ID (redacted addresses)
- Details (what was detected/blocked)

### Log Retention

- Security logs: 90 days minimum
- Audit logs: 1 year minimum
- Privacy: Email addresses and PII redacted

### Alert Thresholds

- **Critical**: Executable attachment detected, ReDoS pattern detected
- **High**: Zip bomb detected, circular reference detected
- **Medium**: Suspicious pattern detected, multiple validation failures
- **Low**: Single validation failure, sanitization applied

## Compliance and Privacy

### Data Privacy

- Email addresses: Redacted in logs (show only domain)
- Email content: Sanitized before storage
- Attachments: Metadata only in logs, not content
- Team members: IDs only, not personally identifiable information

### Audit Trail

- All validation failures logged
- All sanitization actions logged
- All review-required flags logged
- Performance metrics aggregated (no PII)

## Future Enhancements

1. **Machine Learning**: Anomaly detection for unusual patterns
2. **Reputation System**: Track sender trustworthiness
3. **Sandbox Execution**: Analyze suspicious attachments in isolated environment
4. **Advanced Unicode**: Full homograph detection and normalization
5. **Rate Limiting**: Per-sender rate limits to prevent spam/DoS

## Conclusion

This threat model provides comprehensive coverage of security risks for the Team Task Board from Emails tool. All identified threats have corresponding defensive layers in the validation, sanitization, and guard helper implementations.

**Last Updated:** June 18, 2026  
**Next Review:** Quarterly or upon significant changes
