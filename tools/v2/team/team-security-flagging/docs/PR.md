# feat(team-security-flagging): add tests, fixtures, service, and docs

## Summary

- Adds a complete folder-local service (`security-flagging.service.mjs`) with pure functions for input validation, email auto-classification, and status-transition enforcement.
- Adds 50 executable tests (`node:test`, zero external dependencies) covering sanitizers, validators, the keyword classifier, status transitions, and fixture-driven hostile-input rejection.
- Adds structured fixtures (`security-flag-cases.json`) with 6 email signal scenarios, 3 valid flag inputs, 12 hostile inputs, and 13 status transition pairs.
- Adds TypeScript type definitions (`types.ts`) for all domain objects.
- Adds `docs/test-plan.md` and `docs/review-notes.md` for independent OSS contributor review.
- Updates `README.md` with setup instructions, usage examples, fixture descriptions, and known limitations.

## What Changed

### New Files

| File                                     | Description                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                               | TypeScript types - `SecurityFlag`, `CreateFlagInput`, `ClassificationResult`, `ServiceLimits`, etc.                                               |
| `services/security-flagging.service.mjs` | Core pure functions: sanitizers, per-field validators, `classifyEmail` keyword classifier, status-transition guard, severity comparison utilities |
| `fixtures/security-flag-cases.json`      | Test data: email signals, valid flags, hostile inputs, transition pairs                                                                           |
| `tests/security-flagging.test.mjs`       | 50 passing tests using `node:test` with no extra packages                                                                                         |
| `docs/review-notes.md`                   | OSS contributor guide covering what to review, what was intentionally omitted, and the follow-up implementation shape                             |
| `docs/test-plan.md`                      | Full scenario table, injection checks, sanitizer checks, severity table, manual checklist, and known limitations                                  |

### Modified Files

| File        | Description                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `README.md` | Rewritten with setup, folder structure, usage examples, fixture descriptions, known limitations, and an acceptance checklist |

## How to Run Tests

```bash
node --test tools/v2/team/team-security-flagging/tests/security-flagging.test.mjs
```

Expected: **50 tests, 0 failures**. Node 18+ required. No install step.

## Test Coverage Highlights

- **Sanitizers** - control character stripping, non-string null return
- **Validators** - closed enum enforcement for severity, category, and status; CRLF/null-byte/path-traversal/XSS guards on email and ID fields; length limits on description and evidence
- **Classifier** - detects phishing, malware, social engineering, credential theft, and data breach signals; returns low severity for benign content
- **Status transitions** - all 7 valid paths allowed; all 6 blocked paths (including terminal-status exits) rejected
- **Fixture-driven** - all 6 email classifications, all 12 hostile inputs, all valid flag inputs, and all transition pairs exercised from the JSON fixture

## Isolation Guarantee

- No files changed outside `tools/v2/team/team-security-flagging/`.
- No import from the main app, shared components, or design system.
- No database schema, route, navigation, wallet core, or Stellar integration change.
- No React/UI component - deferred to a future UI issue.
- No persistence layer - deferred to a future integration issue.

## Known Limitations

- `classifyEmail` uses keyword matching only; no NLP model, sender-reputation lookup, or link analysis.
- `validateEmail` checks structure and injection vectors but does not verify DNS or MX records.
- CRLF and null-byte injection cases are tested inline (not in the JSON fixture) because those characters are illegal in JSON string literals.
- Flag storage and retrieval require a future integration issue.

## Follow-Up Issues (Not In Scope Here)

- `hooks/use-security-flagging.ts` - React hook wrapping the service with local UI state.
- `components/SecurityFlagForm.tsx` - form for submitting a new flag.
- `components/SecurityFlagList.tsx` - list view for team review.
- Integration issue: wire `classifyEmail` to the inbox email event stream.
- Integration issue: persist flags to the team database.

## Checklist

- [x] All changed files are under `tools/v2/team/team-security-flagging/`
- [x] Tests run with `node --test` and produce 50 pass / 0 fail
- [x] Fixtures contain no real email addresses, credentials, or wallet addresses
- [x] No main app routes, navigation, or design-system changes
- [x] README documents setup, usage, fixtures, and known limitations
- [x] Review notes explain what to validate and what was intentionally deferred
