# Threat Model

## Tool Overview

Role-Based Mail Access enforces which team members can read, write, assign, delete, or manage mail threads based on a declared role. Before implementation code ships, this document defines the threat assumptions and categories of hostile input the guard layer must reject.

## Trust Boundary

The guard module (`guards/access-guards.mjs`) sits at the boundary between caller-supplied input and any downstream access decision. All inputs must be treated as untrusted until validated.

## Roles and Access Levels

| Role      | Allowed levels                      |
| --------- | ----------------------------------- |
| `admin`   | read, write, assign, delete, manage |
| `manager` | read, write, assign                 |
| `agent`   | read, write                         |
| `viewer`  | read                                |
| `guest`   | _(none)_                            |

Any role or access level not in the above table must be rejected before reaching policy evaluation.

## Threat Assumptions

1. **Callers are untrusted.** Role and access-level values must never be taken from a request payload without allowlist validation. A caller claiming to be `admin` cannot be trusted without independent verification.
2. **String inputs may be adversarially crafted.** Input may contain null bytes, Unicode lookalikes, control characters, path separators, or injection payloads.
3. **Thread IDs are opaque identifiers.** They must not be treated as file paths or database queries. Path traversal sequences (`../`) and special characters must be rejected.
4. **Email fields are a header-injection surface.** Any value placed into a mail header must be sanitised for CRLF sequences before use.
5. **Large inputs are a denial-of-service surface.** Unbounded team arrays and attachment lists can cause O(n) scans to degrade. Size caps must be enforced before any iteration.

## Hostile Input Categories

### Role field

| Input                       | Attack vector                 |
| --------------------------- | ----------------------------- |
| `null` / `undefined` / `""` | Null-check bypass             |
| `"ADMIN"`                   | Case-sensitivity bypass       |
| `"superadmin"`, `"root"`    | Non-existent role escalation  |
| `"аdmin"` (Cyrillic а)      | Unicode homoglyph spoofing    |
| `"admin\0"`                 | Null-byte injection           |
| `"admin; DROP TABLE roles"` | SQL / command injection style |
| 65+ character string        | Regex or buffer exhaustion    |

### Access level field

| Input                          | Attack vector                             |
| ------------------------------ | ----------------------------------------- |
| `"superwrite"`, `"*"`, `"all"` | Wildcard or non-existent level escalation |
| `""`                           | Empty-string bypass                       |

### Email field

| Input                                 | Attack vector                    |
| ------------------------------------- | -------------------------------- |
| `"user@evil.test\r\nBcc: victim@..."` | CRLF header injection            |
| `"user\0@evil.test"`                  | Null-byte injection              |
| `"@domain.test"`                      | Missing local part               |
| `"user@"`                             | Missing domain                   |
| `"nodomain"`                          | Missing `@` entirely             |
| 255+ character address                | RFC 5321 violation / buffer risk |

### Thread ID field

| Input                          | Attack vector                |
| ------------------------------ | ---------------------------- |
| `"../../../secret"`            | Path traversal               |
| `"thread 001"`, `"thread\tid"` | Whitespace / tab injection   |
| `"<script>alert(1)</script>"`  | XSS payload in stored ID     |
| `"thread\0id"`                 | Null-byte injection          |
| 129+ character string          | ID exhaustion / lookup abuse |

## Out-of-Scope Threats (follow-up issues)

- Authentication — verifying that the declared role actually belongs to the requester requires session/token integration, which is not part of this isolated tool yet.
- Audit logging — recording access decisions for compliance is a separate concern.
- Rate limiting — preventing brute-force role enumeration requires middleware outside this tool's boundary.
- Encrypted thread IDs — protecting thread IDs from enumeration attacks requires a future architecture decision.
