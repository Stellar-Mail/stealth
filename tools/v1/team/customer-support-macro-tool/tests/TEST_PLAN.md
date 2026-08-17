# Customer Support Macro Tool — Test Plan

## Summary

This document describes the test strategy for the `customer-support-macro-tool`.  
It is written so that an OSS contributor can review, run, and extend the tests without touching any other part of the codebase.

---

## Test topology

```
tools/v1/team/customer-support-macro-tool/
├── tests/
│   ├── macro.service.test.ts   ← unit tests for business logic
│   ├── storage.service.test.ts ← unit tests for persistence layer
│   └── TEST_PLAN.md            ← this file
├── fixtures/
│   └── macros.fixture.ts       ← shared test data
└── services/
    ├── macro.service.ts        ← system under test (pure functions)
    └── storage.service.ts      ← system under test (persistence)
```

---

## How to run

### All unit tests for this tool

```bash
# From the repo root
npx vitest run tools/v1/team/customer-support-macro-tool/tests
```

### Watch mode (re-runs on save)

```bash
npx vitest tools/v1/team/customer-support-macro-tool/tests
```

### Full project unit suite (does not break isolation)

```bash
npm run test
```

> The tool tests live _inside_ the tool folder and are run via vitest's glob
> path argument. They will also be picked up by the root `npm run test` command
> because vitest searches recursively by default.

---

## Test coverage targets

| Area                   | Test file                 | Coverage goal |
| ---------------------- | ------------------------- | ------------- |
| CRUD operations        | `macro.service.test.ts`   | ≥ 90 %        |
| Search & filter        | `macro.service.test.ts`   | ≥ 90 %        |
| Sorting                | `macro.service.test.ts`   | ≥ 90 %        |
| Variable interpolation | `macro.service.test.ts`   | 100 %         |
| Validation             | `macro.service.test.ts`   | 100 %         |
| Storage adapter        | `storage.service.test.ts` | 100 %         |
| Persistence round-trip | `storage.service.test.ts` | 100 %         |

---

## What is tested

### `macro.service.test.ts`

| `describe` block     | Scenarios covered                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `createMacro`        | Field mapping, title/tag normalisation, id uniqueness, ISO timestamps                                      |
| `updateMacro`        | Partial updates, immutability, timestamp refresh                                                           |
| `deleteMacro`        | Remove by id, leave others intact, no-op for missing id                                                    |
| `recordMacroUsage`   | Increments counter, immutability                                                                           |
| `interpolateMacro`   | Known vars replaced, unknown vars left, repeated vars, no-var body                                         |
| `extractVariables`   | Correct extraction, deduplication, order of appearance                                                     |
| `searchMacros`       | No filter, text search, category filter, tag filter (AND), favorites, combined filters, case-insensitivity |
| `sortMacros`         | Title asc/desc, usageCount asc/desc, no mutation                                                           |
| `validateMacroInput` | Valid pass, missing/empty/whitespace title, title too long, missing body, body too long, multiple errors   |

### `storage.service.test.ts`

| `describe` block        | Scenarios covered                                                    |
| ----------------------- | -------------------------------------------------------------------- |
| `createInMemoryAdapter` | Missing key returns null, get/set/remove, pre-seeded data            |
| `loadMacros`            | Empty storage, previously saved data, malformed JSON, non-array JSON |
| `saveMacros`            | Persistence, overwrite                                               |
| `clearMacros`           | Remove data, no-op on empty                                          |
| Round-trip integrity    | All fields preserved through save → load cycle                       |

---

## What is NOT tested here (and why)

| Item                     | Reason                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React hook (`useMacros`) | Requires a React test environment (e.g., `@testing-library/react-hooks`). Deferred to a future hook-testing issue to keep this PR small and reviewable. |
| UI components            | No components are implemented yet. UI issue is tracked separately.                                                                                      |
| E2E / browser tests      | The tool is not wired into the app. E2E tests are added after the integration issue is resolved.                                                        |
| Main app test suite      | This tool must not modify `tests/` at the repo root.                                                                                                    |

---

## Fixtures

All test data lives in `fixtures/macros.fixture.ts`.

| Export                    | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `FIXTURE_MACROS`          | 8 realistic macros covering all 6 categories                |
| `FIXTURE_MACRO_NO_VARS`   | Body with no `{{variables}}` — for interpolation edge cases |
| `FIXTURE_MACRO_WITH_VARS` | Body with 3 variables — for interpolation happy path        |

No network requests, database calls, or file I/O are used in any test.

---

## Known limitations

1. **`useMacros` hook is not unit-tested.** It wraps the service layer, which is
   fully covered. Hook tests require `@testing-library/react` (not in devDeps);
   adding it is a separate issue to avoid scope creep.

2. **localStorage is not tested with the real browser API.** The in-memory
   adapter covers all logic paths. Browser-level quota/private-browsing edge
   cases are handled by a `try/catch` in `localStorageAdapter` but are not
   exercised by vitest.

3. **No concurrency tests.** The hook uses React `useState` which is
   single-threaded in the browser; race conditions between tabs are not handled
   and are considered out of scope for V1.

---

## OSS contributor notes

- All test files are self-contained — you can copy just the `tests/` folder and
  run it independently (with the `services/` and `fixtures/` folders alongside).
- Adding a test case is as simple as adding a new `it(...)` inside the relevant
  `describe` block.
- The in-memory storage adapter means you never need to stub `window.localStorage`.
- If you add a new feature to `macro.service.ts`, add a corresponding
  `describe` block here and open a PR that changes **only files inside this
  tool folder**.
