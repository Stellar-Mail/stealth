# Review Notes

This contribution adds folder-local test coverage and documentation for the Team Security
Flagging tool. It is self-contained and does not touch the main application shell,
routing, inbox architecture, wallet core, Stellar integration, or design system.

## What To Review

### Service logic (`services/security-flagging.service.mjs`)

- Input sanitizers strip control characters before any comparison, preventing injection of
  raw CR/LF/NUL bytes from reaching downstream logic.
- Validators enforce closed enumerations for `severity`, `category`, and `status`. Any
  value not in the allow-list throws `SecurityFlagError` with the offending field named.
- `validateEmail` guards against CRLF header injection and null bytes in addition to
  structural validity.
- `validateThreadId` / `validateEmailId` enforce `^[\w-]+$` to prevent path traversal and
  XSS in IDs.
- `classifyEmail` uses keyword signal maps and match counts to produce severity, category,
  and confidence — all deterministic and testable without mocking.
- `validateStatusTransition` enforces a directed acyclic transition graph. Terminal
  statuses (`resolved`, `dismissed`) block all further changes.

### Fixtures (`fixtures/security-flag-cases.json`)

- Covers six email signal scenarios including phishing, malware, social engineering,
  credential theft, data breach, and a benign newsletter as the low-risk baseline.
- Twelve hostile inputs cover: missing local part, missing domain, empty string, path
  traversal, XSS payload, spaces in IDs, wrong-case enum values, and unknown enum values.
- CRLF and null-byte injection tests are exercised directly in the test file rather than
  in the fixture because those characters are illegal in JSON string literals.
- Seven valid status transitions and six blocked transitions (including all terminal-status
  exit attempts) are fixture-driven.

### Tests (`tests/security-flagging.test.mjs`)

- 50 tests; 0 external dependencies; runs with `node --test` (Node 18+).
- Inline direct tests cover sanitizers, individual validators, classifier categories, and
  severity comparison utilities.
- Fixture-driven tests validate all email signal classifications, all valid/invalid status
  transitions, all hostile inputs, and all valid flag creation inputs.

## What Is Intentionally Not Included

- No app route, navigation link, database migration, or design-system change.
- No background job, analytics event, or external API call.
- No React/UI component — that belongs in a future UI issue.
- No integration with the inbox's real email store — a future integration issue will wire
  the service to a real data source.
- No authentication check — the service is a pure-function core; authorization belongs at
  the call site when integration happens.

## Follow-Up Shape (Future Issues)

A future implementation can add without touching this issue:

- `hooks/use-security-flagging.ts` — React hook wrapping the service with local state.
- `components/SecurityFlagForm.tsx` — form for submitting a new flag.
- `components/SecurityFlagList.tsx` — list of flags for team review.
- Integration issue: wire `classifyEmail` to the actual inbox email event stream.
- Integration issue: persist flags to the team database.
