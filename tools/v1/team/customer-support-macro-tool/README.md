# Customer Support Macro Tool

A self-contained V1 team tool that lets support agents define, manage, and
apply reusable response templates ("macros") with variable interpolation.

**Release tier:** V1  
**Audience:** Team  
**Isolation boundary:** `tools/v1/team/customer-support-macro-tool/`

---

## Table of contents

1. [Purpose](#1-purpose)
2. [Folder structure](#2-folder-structure)
3. [Setup](#3-setup)
4. [Usage](#4-usage)
5. [Fixtures](#5-fixtures)
6. [Running tests](#6-running-tests)
7. [Known limitations](#7-known-limitations)
8. [OSS reviewer notes](#8-oss-reviewer-notes)
9. [Integration roadmap](#9-integration-roadmap)

---

## 1. Purpose

Customer support agents send many similar replies: greetings, refund
confirmations, password-reset instructions, escalation notices.  
This tool provides:

- A **macro library** (CRUD) backed by localStorage.
- **Variable interpolation** — `{{customer_name}}`, `{{ticket_id}}`, etc.
- **Search, filter, and sort** across the library.
- **Usage tracking** (most-used macros float to the top).
- **Validation** before saving.

---

## 2. Folder structure

```
customer-support-macro-tool/
├── services/
│   ├── macro.service.ts        # Pure CRUD / search / validation functions
│   └── storage.service.ts      # localStorage + in-memory adapters
├── hooks/
│   └── useMacros.ts            # React hook wiring services to state
├── fixtures/
│   └── macros.fixture.ts       # Local test data (no network calls)
├── tests/
│   ├── macro.service.test.ts   # Unit tests — service layer
│   ├── storage.service.test.ts # Unit tests — persistence layer
│   └── TEST_PLAN.md            # Full test strategy document
├── docs/
│   └── SETUP.md                # Dev setup guide
├── README.md                   ← you are here
└── specs.md                    # Issue categories and contributor expectations
```

---

## 3. Setup

> **No build step required.** This tool is pure TypeScript. You only need the
> repo's existing toolchain.

```bash
# Install all project dependencies (run once from repo root)
npm install
```

That is all. The tool uses only packages already present in the root
`package.json` (`vitest`, `typescript`). No extra installs needed.

---

## 4. Usage

### Using the service layer directly (no React)

```ts
import { createMacro, searchMacros, interpolateMacro } from "./services/macro.service";

const macro = createMacro({
  title: "Welcome greeting",
  body: "Hi {{customer_name}}, welcome to {{company_name}} support!",
  category: "greeting",
  tags: ["welcome"],
});

const results = searchMacros([macro], { query: "welcome" });

const body = interpolateMacro(macro.body, {
  customer_name: "Alice",
  company_name: "Acme Corp",
});
// → "Hi Alice, welcome to Acme Corp support!"
```

### Using the React hook

```tsx
import { useMacros } from "./hooks/useMacros";
import { FIXTURE_MACROS } from "./fixtures/macros.fixture";

function MacroPanel() {
  const { filteredMacros, addMacro, useMacro, setSearchOptions } = useMacros({
    seedMacros: FIXTURE_MACROS, // optional — seeds when storage is empty
  });

  return (
    <ul>
      {filteredMacros.map((m) => (
        <li key={m.id} onClick={() => useMacro(m.id, { customer_name: "Bob" })}>
          {m.title}
        </li>
      ))}
    </ul>
  );
}
```

### Variable syntax

Variables follow the `{{snake_case_name}}` convention.

```
Hi {{customer_name}},

Your ticket {{ticket_id}} has been assigned to {{agent_name}}.
```

Call `extractVariables(body)` to discover required variables before applying a
macro, so the UI can prompt the agent to fill them in.

---

## 5. Fixtures

`fixtures/macros.fixture.ts` exports pre-built macro objects for use in tests
and development. No network or database access is needed.

| Export                    | Description                      |
| ------------------------- | -------------------------------- |
| `FIXTURE_MACROS`          | 8 macros across all 6 categories |
| `FIXTURE_MACRO_NO_VARS`   | Body with no variable tokens     |
| `FIXTURE_MACRO_WITH_VARS` | Body with 3 variable tokens      |

```ts
import { FIXTURE_MACROS } from "./fixtures/macros.fixture";
```

---

## 6. Running tests

```bash
# Run only this tool's tests (from repo root)
npx vitest run tools/v1/team/customer-support-macro-tool/tests

# Watch mode
npx vitest tools/v1/team/customer-support-macro-tool/tests

# Full project test suite (includes this tool)
npm run test
```

See [`tests/TEST_PLAN.md`](./tests/TEST_PLAN.md) for the full test strategy,
coverage targets, and a description of every test case.

---

## 7. Known limitations

| Limitation                  | Detail                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| localStorage only           | No sync across tabs. Tab isolation is fine for V1.                                                                                  |
| No server-side storage      | Macros are local to the browser. Cloud sync is a V2 concern.                                                                        |
| Hook not unit-tested        | `useMacros.ts` wraps the fully-tested service layer. Full hook tests require `@testing-library/react`, which is not in devDeps yet. |
| No UI component             | The component layer is planned in a separate issue.                                                                                 |
| No conflict resolution      | If two agents edit the same macro name, last write wins.                                                                            |
| Max body length 4,000 chars | Enforced by `validateMacroInput`. Configurable in a future issue.                                                                   |

---

## 8. OSS reviewer notes

### How to review this contribution independently

1. **Read `tests/TEST_PLAN.md`** — it maps every test file to the feature it exercises.
2. **Run the tests** (`npx vitest run tools/v1/team/customer-support-macro-tool/tests`) — all should pass.
3. **Inspect the services** — `macro.service.ts` contains only pure functions. No side effects, no React, no imports from `src/`.
4. **Check isolation** — `grep -r "from.*src/" tools/v1/team/customer-support-macro-tool/` should return **zero** results.
5. **Verify boundary** — no file outside `tools/v1/team/customer-support-macro-tool/` is modified by this PR.

### What reviewers should NOT worry about

- Wiring into the main app (deliberately deferred to an integration issue).
- Database schema (no DB in this tool).
- Auth / wallet / Stellar (out of scope by issue definition).

---

## 9. Integration roadmap

When a future integration issue is opened, the following adapter points are ready:

| Hook / function                 | Integration point                                 |
| ------------------------------- | ------------------------------------------------- |
| `useMacros({ storageAdapter })` | Swap in a server-backed adapter                   |
| `createMacro / updateMacro`     | POST/PATCH to a REST or GraphQL endpoint          |
| `interpolateMacro`              | Called in the compose window before message send  |
| `extractVariables`              | Drives the variable-fill prompt in the compose UI |
