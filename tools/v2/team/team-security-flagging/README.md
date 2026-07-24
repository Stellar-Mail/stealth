# Team Security Flagging

A V2 team tool for reporting, classifying, and tracking security incidents in team email.
Isolated to this folder — not wired into the main app yet.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/team-security-flagging/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core,
Stellar integration, database schema, or design system unless a future integration issue
explicitly allows it.

---

## Folder Structure

```
team-security-flagging/
  types.ts                             TypeScript types (no runtime)
  services/
    security-flagging.service.mjs      Core pure functions — classification, validation,
                                       status transitions
  fixtures/
    security-flag-cases.json           Test data: email signals, valid flags, hostile
                                       inputs, status transition pairs
  tests/
    security-flagging.test.mjs         50 executable tests (node:test, zero deps)
  docs/
    test-plan.md                       Scenario table, negative checks, manual checklist
    review-notes.md                    OSS contributor review guide
  specs.md                             Issue categories and contributor expectations
  README.md                            This file
```

---

## Setup

No install step is required. The service and tests use only Node built-ins.

**Requirements:** Node 18 or later.

---

## Running the Tests

From the repo root:

```
node --test tools/v2/team/team-security-flagging/tests/security-flagging.test.mjs
```

Or from inside the tool folder:

```
node --test tests/security-flagging.test.mjs
```

Expected output: **50 tests, 0 failures**.

---

## Core Concepts

### SecurityFlag

A flag marks an email thread as a security incident. Key fields:

| Field         | Type                                                                                                                                | Notes                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `severity`    | `critical \| high \| medium \| low`                                                                                                 | Set by reporter or auto-classifier |
| `category`    | `phishing \| credential-theft \| malware \| data-breach \| suspicious-sender \| unauthorized-access \| social-engineering \| other` | Nature of threat                   |
| `status`      | `new \| under-review \| escalated \| resolved \| dismissed`                                                                         | Lifecycle state                    |
| `evidence`    | `string[]`                                                                                                                          | Up to 10 items, 500 chars each     |
| `description` | `string`                                                                                                                            | Up to 2000 chars                   |

### Auto-Classification

`classifyEmail(signal)` takes a minimal email signal (subject, snippet, bodyPreview,
senderEmail) and returns a `ClassificationResult` with severity, category, confidence,
and the matched signal phrases. It uses keyword matching across six threat categories.

### Status Lifecycle

```
new ──► under-review ──► escalated ──► resolved
  │            │               │
  └────────────┴───────────────┴──► dismissed
```

`resolved` and `dismissed` are terminal — no further transitions are allowed.
`validateStatusTransition(from, to)` throws `SecurityFlagError` for any invalid move.

---

## Using the Service

```js
import {
  classifyEmail,
  validateCreateFlagInput,
  validateStatusTransition,
  SecurityFlagError,
} from "./services/security-flagging.service.mjs";

// Auto-classify an incoming email
const result = classifyEmail({
  subject: "Urgent: Verify your account",
  senderEmail: "support@unknown-domain.example",
  snippet: "Click here to confirm your credentials before your account is suspended.",
  bodyPreview: "Act now. Urgent action required.",
});
// { severity: "critical", category: "phishing", confidence: "high", matchedSignals: [...] }

// Validate flag input before storing
try {
  validateCreateFlagInput({
    emailId: "email-001",
    threadId: "thread-001",
    reportedBy: "alice@company.example",
    senderEmail: "support@unknown-domain.example",
    severity: "critical",
    category: "phishing",
    description: "Credential harvest attempt from unknown sender.",
    evidence: ["Domain not in vendor list", "Urgent suspension threat language"],
  });
} catch (err) {
  if (err instanceof SecurityFlagError) {
    console.error(err.field, err.message);
  }
}

// Guard a status change
validateStatusTransition("new", "under-review"); // ok
validateStatusTransition("resolved", "new"); // throws SecurityFlagError
```

---

## Non-UI Execution Contract

`executeSecurityFlagging(input, dependencies)` is the stable backend-facing
entry point. Its typed input, success record, error envelope, and injected
service boundaries are declared in `contract/execution-contract.d.ts` and
exported through `index.ts`. It has no React, DOM, styling, or layout concerns.

```js
import { executeSecurityFlagging } from "./services/security-flagging-execution.service.mjs";

const outcome = await executeSecurityFlagging(input, {
  authorizeReporter: (email) => authorizationService.canReport(email),
  findActiveFlag: ({ emailId, threadId }) => repository.findActive(emailId, threadId),
  persistFlag: (record) => repository.insert(record),
  generateId: () => crypto.randomUUID(),
  now: () => new Date(),
});
```

Expected failures return a discriminated `{ ok: false, error }` result with one
of these stable codes: `INVALID_INPUT`, `UNAUTHORIZED_REPORTER`,
`DUPLICATE_FLAG`, `PERSISTENCE_FAILED`, or `INTERNAL_ERROR`. Callers should
branch on `error.code`, not the human-readable message.

Authorization, duplicate lookup, persistence, ID generation, and time are
caller-supplied service boundaries. This makes execution deterministic in tests
and independent of databases, transports, and presentation code.

The companion `fixtures/execution-contract-cases.json` covers deterministic
success plus validation, authorization, duplicate, persistence, and unexpected
dependency failures.

## Fixtures

`fixtures/security-flag-cases.json` contains:

- **`emailSignals`** — six emails from benign to critical, each with expected
  classification output.
- **`validFlags`** — three well-formed flag creation inputs.
- **`hostileInputs`** — twelve rejection cases (path traversal, XSS, wrong-case enums,
  empty strings, invalid email formats).
- **`statusTransitions`** — valid and blocked transition pairs.

All fixture emails use `*.example`, `*.example.net`, `*.example.com`, and
`*.example.xyz` domains. No real addresses, credentials, or wallet values are included.

---

## Known Limitations

- `classifyEmail` is keyword-based; it has no NLP model, sender-reputation lookup, or
  link-analysis step. False positives and false negatives are expected in edge cases.
- The service has no persistence layer. Storing and retrieving flags requires a future
  integration issue.
- `validateEmail` checks structure and injection vectors only — it does not verify DNS
  or MX records.
- CRLF and null-byte injection cases are tested with inline strings in the test file
  because those characters cannot appear in JSON string literals.
- No UI component, hook, or route exists yet. Those belong in future issues.

---

## Acceptance Checklist

- [x] Tests live inside this folder and run with `node --test`.
- [x] Documentation explains independent setup and review.
- [x] No files changed outside `tools/v2/team/team-security-flagging/`.
- [x] Fixtures contain no real personal data, credentials, or wallet addresses.
- [x] The tool is reviewable as a self-contained mini-product change.
