# Team Payment Approval – Contributor Guide

Welcome. This guide explains how to contribute to the Team Payment Approval tool safely and correctly. Read it before opening a PR.

---

## What This Tool Is

A self-contained mini-product for reviewing and approving team payment requests. It lives entirely inside:

```
tools/v2/team/team-payment-approval/
```

It has no connection to the main app right now. That connection is a future integration issue.

---

## Before You Start

Read these three documents first:

| Document | What it covers |
|----------|----------------|
| `ARCHITECTURE.md` | Folder structure, module overview, dependency graph |
| `MODULE_BOUNDARIES.md` | What each module owns, its public API, allowed/forbidden imports |
| `INTEGRATION_CONSTRAINTS.md` | The hard boundaries you must never cross |
| `DATA_OWNERSHIP.md` | How data flows and where it is stored |

If anything is unclear, ask before writing code.

---

## Folder Map (Quick Reference)

```
team-payment-approval/
├── components/       UI components (presentational)
├── hooks/            State management and async logic
├── services/         Business logic and local data
├── types/            TypeScript types only
├── fixtures/         Mock data for dev and tests
├── tests/            Unit and integration tests
└── docs/             Accessibility, visual style, getting started
```

**Rule:** Every file you create or modify must be inside this folder.

---

## Contribution Workflow

### 1. Pick the right module

| What you're changing | Where it goes |
|----------------------|---------------|
| UI layout or behavior | `components/` |
| State, async logic, error handling | `hooks/` |
| Data storage or business rules | `services/` |
| New TypeScript interfaces or unions | `types/` |
| Test data or demo scenarios | `fixtures/` |
| Tests | `tests/` |
| Keyboard, screen reader, visual docs | `docs/` |

### 2. Define types first

If your feature introduces new data shapes, add them to `types/payment.ts` before writing implementation code. This makes review easier and keeps the dependency graph clean.

### 3. Implement in services

Business logic belongs in services, not in hooks or components. Keep service methods stateless and easy to unit-test in isolation.

### 4. Expose through hooks

If a component needs async behavior or stateful data, wrap the service call in a hook. Components should never call services directly.

### 5. Build components last

Components receive everything via props and callbacks. They don't know where data comes from.

### 6. Add tests

Every new service method and hook behavior needs at least one unit test. Use fixtures from `fixtures/` — don't invent inline test data.

### 7. Update docs

- If you changed keyboard behavior → update `docs/ACCESSIBILITY.md`
- If you changed visual design → update `docs/VISUAL_STYLE.md`
- If you changed the module structure → update `ARCHITECTURE.md` and this guide

---

## What You Can Change

```
✅ components/          Add, edit, or refactor UI components
✅ hooks/               Add or modify hooks
✅ services/            Add or modify service methods
✅ types/               Add new types or extend existing ones
✅ fixtures/            Add new mock scenarios
✅ tests/               Add or improve tests
✅ docs/                Update any local documentation
✅ styles.css           Add component-scoped styles
✅ index.ts             Update public exports to match new modules
✅ README.md            Keep usage examples current
✅ specs.md             Expand acceptance criteria if scope grows
```

---

## What You Must Not Change

```
❌ src/                       Main application source
❌ src/routes/                Routing
❌ src/server/                Server and database
❌ src/features/              App features
❌ src/components/            Shared components
❌ src/features/design-system Design system tokens
❌ package.json               Root dependencies (discuss first)
❌ tsconfig.json              TypeScript config
❌ vite.config.ts             Build config
❌ eslint.config.js           Lint config
❌ playwright.config.ts       E2E config
❌ infra/                     Infrastructure
❌ contracts/                 Soroban smart contracts
❌ protocol/                  Protocol specs
❌ docs/ (top-level)          Top-level project docs
```

---

## Adding a New Component

1. Create the file in `components/`
2. Define props interface in the same file or in `types/`
3. Use hooks for any state or side effects
4. Add keyboard navigation if the component is interactive
5. Add ARIA labels, roles, and live regions as needed
6. Export from `components/index.ts`
7. Export from the tool's root `index.ts` if it's part of the public API
8. Add a usage example to `README.md`

**Accessibility minimum bar for interactive components:**

- Every interactive element has an accessible label
- Full keyboard support (Tab, Escape, Enter/Space, Arrow keys where relevant)
- Focus indicators visible on all interactive elements
- Status changes announced via `aria-live` or `role="alert"`

---

## Adding a New Service Method

1. Add the method signature to `MODULE_BOUNDARIES.md` public API table
2. Implement in the relevant service file
3. Add JSDoc comment explaining parameters, return value, and side effects
4. Write a unit test in `tests/unit/services/`

---

## Adding a New Hook

1. Add the hook signature to `MODULE_BOUNDARIES.md` public API table
2. Implement in `hooks/`
3. Wrap all async calls with try/catch; always surface `isLoading` and `error`
4. Export from `hooks/index.ts`
5. Write a unit test in `tests/unit/hooks/`

---

## Adding Test Fixtures

1. Add data to `fixtures/payments.fixtures.ts`
2. Cover all `ApprovalStatus` and `PaymentPriority` values if adding new scenarios
3. Use realistic but fictional names, amounts, and descriptions
4. Export a named helper function if the scenario has a specific use case

---

## Running Tests Locally

```bash
# Unit tests (from workspace root)
bun run test --filter tools/v2/team/team-payment-approval

# Or with vitest directly from tool folder
npx vitest run tests/
```

---

## Accessibility Checklist

Before submitting a PR that touches any UI component:

```
[ ] All interactive elements reachable by Tab
[ ] Escape closes modals/dialogs and returns focus
[ ] Arrow keys navigate list rows
[ ] Enter/Space activates buttons and selected items
[ ] Focus indicator visible on every interactive element
[ ] Screen reader announces loading, error, and success states
[ ] Color is not the only way information is conveyed
[ ] WCAG AA contrast on all text (4.5:1 normal, 3:1 large)
[ ] prefers-reduced-motion respected
[ ] Dark mode tested
```

---

## PR Checklist

```
[ ] All files changed are inside tools/v2/team/team-payment-approval/
[ ] No imports from src/
[ ] Module boundaries respected
[ ] Types defined before implementation
[ ] New service methods unit tested
[ ] New hooks unit tested
[ ] Fixtures added for new scenarios
[ ] Accessibility checklist passed (if UI changes)
[ ] Docs updated where relevant
[ ] ARCHITECTURE.md updated if module structure changed
[ ] No console errors or warnings
[ ] No main app integration attempted
```

---

## Future Integration

When this tool is ready to connect to the main app, that work goes in a **separate issue**. That issue will:

- Create a wrapper in `src/features/team-payment-approval-integration/`
- Wire into app routing and authentication
- Connect to real payment data and API
- Add database persistence and audit logging

Do not attempt any of this in contributions to this folder.

---

## Questions?

If something in the architecture feels wrong or a constraint seems to block a legitimate need, open a discussion before writing code. It is far easier to adjust a plan than to untangle a PR that crossed a boundary.
