# Test Plan — Team Security Flagging

Tests live in `tests/security-flagging.test.mjs` and are executable today.
Run with:

```
node --test tests/security-flagging.test.mjs
```

No build step, no extra packages. Node 18+ is the only requirement.

---

## Fixture Setup

Load test data from:

```
fixtures/security-flag-cases.json
```

The fixture contains four top-level keys:

| Key                 | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `emailSignals`      | Six email scenarios with expected classification output          |
| `validFlags`        | Three well-formed flag creation inputs that must pass validation |
| `hostileInputs`     | Twelve rejection cases covering injection and enum misuse        |
| `statusTransitions` | Seven valid and six blocked status transitions                   |

---

## Scenarios

### Classification (`classifyEmail`)

| Fixture ID                         | Email type                                 | Expected severity | Expected category    |
| ---------------------------------- | ------------------------------------------ | ----------------- | -------------------- |
| `phishing-credential-harvest`      | Credential phishing with suspension threat | `critical`        | `phishing`           |
| `malware-invoice-attachment`       | Invoice with macro attachment              | `critical`        | `malware`            |
| `social-engineering-wire-transfer` | BEC wire-transfer request                  | `critical`        | `social-engineering` |
| `credential-reset-otp`             | Multi-signal credential-theft attempt      | `critical`        | `credential-theft`   |
| `data-breach-notification`         | Breach notification with multiple signals  | `critical`        | `data-breach`        |
| `low-risk-newsletter`              | Product digest with no threat signals      | `low`             | `other`              |

Confidence is asserted separately — all threat scenarios expect `"high"`, the benign
newsletter expects `"low"`.

### Input Validation (`validateCreateFlagInput`)

| Fixture ID | Checks                                      |
| ---------- | ------------------------------------------- |
| `flag-001` | Phishing flag; all required fields valid    |
| `flag-002` | Malware flag; evidence array with two items |
| `flag-003` | Social-engineering flag; critical severity  |

### Status Transitions (`canTransition` + `validateStatusTransition`)

**Valid paths:**

- `new → under-review`
- `new → dismissed`
- `under-review → escalated`
- `under-review → resolved`
- `under-review → dismissed`
- `escalated → resolved`
- `escalated → dismissed`

**Blocked paths (must throw `SecurityFlagError`):**

- `new → escalated` (cannot skip `under-review`)
- `new → resolved` (cannot skip `under-review`)
- `resolved → *` (terminal)
- `dismissed → *` (terminal)

---

## Negative / Injection Checks

| Field      | Hostile value               | Reason blocked     |
| ---------- | --------------------------- | ------------------ |
| `email`    | `@missinglocal.test`        | Missing local part |
| `email`    | `nodomain`                  | Missing `@` sign   |
| `email`    | `""`                        | Empty string       |
| `email`    | `user@`                     | Missing domain     |
| `threadId` | `../../../etc/passwd`       | Path traversal     |
| `threadId` | `<script>alert(1)</script>` | XSS payload        |
| `threadId` | `thread 001`                | Space in ID        |
| `severity` | `CRITICAL`                  | Wrong case         |
| `severity` | `extreme`                   | Unknown value      |
| `category` | `hacking`                   | Unknown value      |
| `status`   | `pending`                   | Unknown value      |
| `status`   | `RESOLVED`                  | Wrong case         |

CRLF injection (`\r\n` in an email header field) and null-byte injection are tested
directly in the test file with inline strings because those characters cannot appear in
JSON string literals.

---

## Sanitizer Checks

| Input              | Expected output                       |
| ------------------ | ------------------------------------- |
| `"  hello  "`      | `"hello"` (trimmed)                   |
| `"hello\x00world"` | `"helloworld"` (NUL stripped)         |
| `"line\x1Fbreak"`  | `"linebreak"` (control char stripped) |
| `null`, `42`, `{}` | `null` (non-string → null)            |

---

## Severity Comparison

| Assertion                          | Expected     |
| ---------------------------------- | ------------ |
| `isMoreSevere("critical", "high")` | `true`       |
| `isMoreSevere("low", "high")`      | `false`      |
| `maxSeverity("high", "critical")`  | `"critical"` |
| `maxSeverity("low", "high")`       | `"high"`     |
| `maxSeverity("medium", "medium")`  | `"medium"`   |

---

## Manual Review Checklist

1. All changed files are under `tools/v2/team/team-security-flagging/`.
2. No import from the main app, no shared component, no database schema change.
3. Fixture emails do not contain real email addresses, real credentials, or live wallet
   addresses.
4. `node --test` exits with code 0 and reports 50 pass / 0 fail.
5. The README explains how to run tests independently.
6. Future executable tests targeting UI or hook layers can be added to this same folder
   without touching the main app test suite.

---

## Known Limitations

- `classifyEmail` uses keyword matching only. It has no NLP model, sender reputation
  lookup, or link analysis. Multi-signal thresholds approximate real-world heuristics.
- The service holds no persistent state. Flag storage is intentionally left to a future
  integration issue.
- `validateEmail` enforces structural rules but does not verify DNS or MX records.
- Status transitions are validated at the service layer; enforcement at the persistence
  layer is a future concern.
