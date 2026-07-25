## Summary

Add contributor-friendly tests and documentation for the Suspicious Sender Watchlist V2 team tool.

## Issue

Close #673

## Summary of the Issue

The Suspicious Sender Watchlist tool needed comprehensive testing infrastructure and documentation to make it easy for OSS contributors to validate, review, and extend the code. The existing codebase had a strong foundation (types, contract, service, guards, hooks, components, fixtures) but was missing key contributor-facing artifacts.

## Root Cause

The tool lacked:

- A local `vitest.config.ts` to run TypeScript contract tests independently
- A documented test plan with coverage matrix and manual review checklist
- Comprehensive testing documentation covering setup, fixtures, and writing new tests
- A complete tool-level README documenting architecture, usage, and known limitations

## Solution Implemented

Created three new files and updated one existing file, all strictly inside `tools/v2/team/suspicious-sender-watchlist/`:

### 1. `vitest.config.ts` (NEW)

Standalone Vitest configuration following the same pattern as `role-based-mail-access` and `manager-review-queue`. Enables running contract tests with:

```bash
npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
```

### 2. `tests/test-plan.md` (NEW)

Full coverage matrix documenting all 130+ test cases across three suites:

- **Guard tests** (66 tests): sanitizeText, validateWatchlistId, validateSenderEmail, validateSenderName, validateReason, validateNotes, validateRiskLevel, validateEntryStatus, validateSearchQuery, guardWatchlistSize, validateAddEntryInput, LIMITS
- **Service tests** (52 tests): fixtures, computeMetrics, applyFilter, service CRUD, guard integration at service boundary
- **Contract tests** (12 tests): result helpers, operation routing, error mapping

Includes manual review checklist and documented known limitations (no UI component tests, no E2E tests, no pagination, no audit trail, no export, etc.).

### 3. `docs/testing.md` (NEW)

Comprehensive testing guide covering:

- Overview of all three test suites with detailed per-function descriptions
- Quick start and prerequisites
- Fixtures reference table (all 6 deterministic entries)
- How to write new tests for guards, services, and contracts
- CI matrix configuration snippet
- Known limitations table

### 4. `docs/README.md` (UPDATED)

Replaced the UI-only README with a complete tool-level documentation:

- Architecture diagram showing all 4 layers (UI → Contract → Service → Guards)
- Layer responsibilities table
- Data flow description
- Setup prerequisites and quick-start commands
- Usage examples for contract, React UI, React hook, and direct service access
- Complete folder structure
- Fixtures documentation
- Testing quick-reference table
- Known limitations table with future work items
- Related documentation index

## Key Changes Made

1. **`tools/v2/team/suspicious-sender-watchlist/vitest.config.ts`** — Created with tsConfigPaths plugin, Node environment, folder-scoped test inclusion, 10s timeout
2. **`tools/v2/team/suspicious-sender-watchlist/tests/test-plan.md`** — Created with full coverage matrix (130+ cases), manual review checklist, known gaps
3. **`tools/v2/team/suspicious-sender-watchlist/docs/testing.md`** — Created with setup, suite details, fixtures reference, writing guide, CI matrix
4. **`tools/v2/team/suspicious-sender-watchlist/docs/README.md`** — Replaced UI-only docs with full tool documentation including architecture, usage, fixtures, testing, and limitations

## Testing Steps

1. Run guard tests (no dependencies, runs with built-in Node test runner):

   ```bash
   node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist-guards.test.mjs
   ```

   Expected: 66 tests pass

2. Run service tests (no dependencies):

   ```bash
   node --test tools/v2/team/suspicious-sender-watchlist/tests/watchlist.test.mjs
   ```

   Expected: 52 tests pass

3. Run contract tests (requires `npm install` from repo root):

   ```bash
   npx vitest run --config tools/v2/team/suspicious-sender-watchlist/vitest.config.ts
   ```

   Expected: 12 tests pass

4. Verify all changed files are inside `tools/v2/team/suspicious-sender-watchlist/`

## Trade-offs and Considerations

- **No UI component tests**: The React components still lack automated coverage. Adding `@testing-library/react` tests is tracked in the known limitations and should be a follow-up issue.
- **No vitest config for `.mjs` tests**: The guard and service tests intentionally use Node's built-in test runner (`node --test`) rather than Vitest, making them zero-dependency and CI-friendly. Only the TypeScript contract tests require Vitest.
- **No E2E tests**: The tool is deliberately not mounted in the main application, so end-to-end testing is out of scope until a future integration issue.
- **All documentation uses relative links**: Every cross-reference uses `./` or `../` paths that work regardless of where the repo is cloned.

---

Please kindly review this task. If there are any corrections, improvements, adjustments, or merge conflicts that you notice regarding my implementation, I'd really appreciate your feedback. I'd also love to hear your overall review of my work on this branch. Thank you!
