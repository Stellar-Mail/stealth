# Role-Based Mail Access UI

This document provides setup instructions and visual guide details for the **Role-Based Mail Access Control Plane** interface.

## Visual Design System & Key States

The interface implements a curated dark-mode palette (`bg-zinc-950` / `bg-zinc-900`) styled with responsive flex grids and interactive overlays, supporting the following states:

1. **Empty State**:
   - Renders a clean placeholder illustration with call-to-action hints inside the audit logs tracker when no checks have run.
2. **Loading State**:
   - Simulates check delay with a smooth, pulsing loader and spinning indicators, accompanied by `role="status"` and `aria-live="polite"` tags to notify assistive technologies.
3. **Success State (Authorized)**:
   - Evaluated requests that align with policy render a green banner (`bg-emerald-500/10 text-emerald-400`), confirming authorization and adding an audit log.
4. **Access Denied State**:
   - Evaluated requests that violate policies trigger an amber warning alert (`bg-amber-500/10 text-amber-400`), stating that the operation is blocked.
5. **Error State (Validation Failures)**:
   - Malformed fields (e.g. invalid emails, injection script threadIds, oversized input bounds) trigger a red border around the target input and show a focused red error block (`bg-rose-500/10 text-rose-400`) explaining the validation constraint.

## Directory Structure

All implementation files are housed locally:

```text
role-based-mail-access/
├── types/
│   └── index.ts                # TypeScript types (Requests, Logs, Policies)
├── fixtures/
│   └── sample-access-requests.json # Preloaded valid & hostile mock datasets
├── guards/
│   └── access-guards.mjs       # Low-level validation libraries
├── services/
│   └── access.service.ts       # Policy editor, logs tracker, and limit verifier
├── hooks/
│   └── use-role-based-access.ts # State synchronization hook
├── components/
│   ├── PolicyMatrix.tsx        # Toggle matrix for permission checks
│   ├── AccessVerifier.tsx      # Validation credentials form & error display
│   ├── AccessConsole.tsx       # Combined dashboard layout orchestrator
│   └── index.ts                # Public exports index
├── tests/
│   ├── access-guards.test.mjs  # Native Node unit tests for guards
│   └── ui-service.test.ts      # Vitest unit tests for service state
├── docs/
│   ├── README.md               # Visual style and state guide
│   ├── ARCHITECTURE.md         # Component mapping and structural flow
│   ├── ACCESSIBILITY.md        # Focus routes and screen reader WAI-ARIA states
│   └── review-notes.md         # OSS reviewer validation guide
├── demo.tsx                    # Dev preview harness
├── vitest.config.ts            # Isolated Vitest configuration
├── specs.md                    # Scaffold constraints
└── README.md                   # Root README page
```

## Running Tests

### Running UI Service Tests (Vitest)

```bash
npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run
```

### Running Native Guard Tests (Node.js)

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
```
