# Inbox Daily Digest

This folder is the isolated workspace for the Inbox Daily Digest tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/inbox-daily-digest/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

---

## Technical Architecture

### components/
- `InboxDailyDigestTool.tsx`: Container component managing scope config (`includeReceipts`, `includeLowPriority`), tone, generation states, and rendering.
- `states/DigestEmptyState.tsx`: Idle screen prompting user to generate daily digest preview.
- `states/DigestLoadingState.tsx`: Accessible loading screen with spinner and `aria-busy="true"` attributes.
- `states/DigestErrorState.tsx`: Displays errors with dynamic message and a retry button.
- `states/DigestSuccessState.tsx`: Lists generated daily digest summaries, metrics, next actions, and any warning logs.

### services/
- `digestGuards.ts`: Sanitization, validation, and cap-limiting function `guardDigestEmails` that filters malformed data, truncates long fields to prevent denial-of-service, and flags control characters.

---

## Setup & Running Tests

### Running Unit Tests
Unit tests are fully isolated and live inside the `tests/` subdirectory:
- `tests/digestGuards.test.ts`: Covers array snapshot checks, invalid structures, normalization, and bounds capping.
- `tests/components.test.ts`: Verifies structural correctness and accessibility markers of UI components in various states.

To execute tests for this tool independently:
```bash
npx vitest run -c tools/v1/individual/inbox-daily-digest/vitest.config.ts
```

---

## Testing & Handoff Review Guide

To review and validate this contribution as a self-contained mini-product change:
1. Confirm that files modified or created are strictly confined to this folder (`tools/v1/individual/inbox-daily-digest/`).
2. Run the independent unit test suite commands and verify they pass.
3. Confirm linter compliance by running `npx eslint tools/v1/individual/inbox-daily-digest/components/` and `npx eslint tools/v1/individual/inbox-daily-digest/services/`.
4. Review threat assumptions in `docs/security-performance.md` to ensure safe input handling.
