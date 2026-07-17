# Customer Support Macro Tool — Setup Guide

## Prerequisites

| Requirement | Version | Notes             |
| ----------- | ------- | ----------------- |
| Node.js     | ≥ 18    | LTS recommended   |
| npm         | ≥ 9     | Bundled with Node |

No additional tools are needed. This tool uses only the project-level
`vitest` and `typescript` that are already in `package.json`.

---

## 1. Clone and install

```bash
git clone https://github.com/binayyub4211/stealth.git
cd stealth
npm install
```

---

## 2. Verify the tool folder exists

```bash
ls tools/v1/team/customer-support-macro-tool/
```

Expected contents:

```
services/   hooks/   fixtures/   tests/   docs/   README.md   specs.md
```

---

## 3. Run the tests

```bash
# Run only this tool's tests
npx vitest run tools/v1/team/customer-support-macro-tool/tests

# Watch mode (re-runs on file save)
npx vitest tools/v1/team/customer-support-macro-tool/tests
```

All tests should pass. No network access or environment variables required.

---

## 4. Understand the fixtures

All test data is defined locally in:

```
fixtures/macros.fixture.ts
```

You can import fixtures in any test without any setup or teardown:

```ts
import { FIXTURE_MACROS } from "../fixtures/macros.fixture";
```

---

## 5. Develop locally

Because this tool does not require the full app to run, you can work on the
service layer in pure TypeScript:

```ts
// scratch.ts — run with: npx tsx scratch.ts
import { createMacro, interpolateMacro } from "./services/macro.service";

const m = createMacro({
  title: "Test",
  body: "Hello {{name}}",
  category: "general",
});

console.log(interpolateMacro(m.body, { name: "Alice" }));
// → "Hello Alice"
```

> `tsx` is not in devDeps. Install it temporarily with `npx tsx scratch.ts` or
> write a vitest test instead, which is the preferred approach.

---

## 6. TypeScript

The tool is fully typed. No `any` is used in the service or fixture files.
TypeScript errors are surfaced by:

```bash
npx tsc --noEmit
```

---

## 7. Adding a new macro category

1. Add the new value to the `MacroCategory` union type in `services/macro.service.ts`.
2. Add a test case in `tests/macro.service.test.ts` confirming the category passes validation.
3. Add a sample macro for the category in `fixtures/macros.fixture.ts`.
4. Open a PR that touches **only** files inside this tool folder.

---

## 8. Environment variables

None required. This tool uses no environment variables, API keys, or secrets.

---

## 9. Linting and formatting

```bash
# Lint
npm run lint

# Format
npm run format
```

Both commands run from the repo root and include this tool folder automatically.
