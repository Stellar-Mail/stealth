# Team Payment Approval – Integration Constraints

This document lists what this tool **can and cannot do**. These rules are non-negotiable — PRs that violate them will be rejected regardless of code quality.

---

## The Hard Boundaries

```
1. Never import from src/
2. Never modify any file outside tools/v2/team/team-payment-approval/
3. Never export from this tool for direct use by the main app
4. Never access the main app's database, wallet, Stellar core, or mail engine
5. Never wire into main app routing or navigation
6. Never depend on main app authentication
7. Never call main app server APIs
```

If you need something from the main app, write it as a **separate follow-up integration issue** after this tool is validated.

---

## Forbidden Imports

### ❌ Never import these

```typescript
// Main app components
import { MailList } from "../../../src/components/mail";
import { ComposeDraft } from "../../../src/features/compose";

// Main app services
import { sendEmail } from "../../../src/services/mail";
import { getBalance } from "../../../src/services/wallet";
import { submitTransaction } from "../../../src/services/stellar";

// Main app hooks
import { useMailContext } from "../../../src/features/mail/hooks";
import { useWalletContext } from "../../../src/features/ledger/hooks";
import { useAuth } from "../../../src/services/auth";

// Main app routing
import { useRouter } from "../../../src/router";
import { Navigate } from "../../../src/routes";

// Main app stores / state
import { useMailStore } from "../../../src/stores/mail";
import { useUserStore } from "../../../src/stores/user";

// Main app server
import { apiClient } from "../../../src/server/api";
import { db } from "../../../src/server/db";
import { schema } from "../../../src/server/schema";

// Main app types
import type { Mail } from "../../../src/types/mail";
import type { User } from "../../../src/types/user";
```

### ✅ These imports are allowed

```typescript
// Within tool boundary
import { usePaymentApproval } from "../hooks/use-payment-approval";
import { paymentService } from "../services/payment.service";
import type { PaymentRequest } from "../types";
import { mockPayments } from "../fixtures/payments.fixtures";

// React standard library
import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode, FC } from "react";

// Radix UI (styling only — do not re-export wrappers for main app)
import { Button } from "@radix-ui/react-button";

// External libraries already in package.json
// (check before adding; don't bump React or other core deps)
```

---

## Forbidden File Modifications

### ❌ Never touch these

```
src/                              # Entire main app source
src/router.tsx                    # Routing
src/routeTree.gen.ts              # Generated route tree
src/routes/                       # Route files
src/server/                       # Server endpoints and DB
src/features/                     # App features
src/components/                   # Shared components
src/services/                     # App-level services
src/hooks/                        # App-level hooks
src/stores/                       # Global state stores
src/types/                        # App-level types

package.json                      # Root dependencies
tsconfig.json                     # TypeScript config
vite.config.ts                    # Build config
eslint.config.js                  # Linting config
playwright.config.ts              # E2E config
wrangler.jsonc                    # Cloudflare Workers config

infra/                            # Infrastructure
contracts/                        # Soroban contracts
docs/                             # Top-level docs (not this tool's docs/)
protocol/                         # Protocol specs
```

### ✅ Only these paths are in scope

```
tools/v2/team/team-payment-approval/   # Everything in here
```

---

## Forbidden Functionality

### Network & Server Access

```typescript
// ❌ No calls to main app server
const response = await fetch("/api/payments/approve");

// ❌ No tRPC / server router
import { api } from "../../../src/server/router";

// ✅ Local storage only
const stored = localStorage.getItem("team-payment-approval:decisions");
```

### Authentication & Identity

```typescript
// ❌ No main app auth
const { user } = useAuth();
if (!user.canApprove) return;

// ✅ Tool is auth-agnostic; caller passes approver identity via props/callbacks
```

### Wallet & Stellar

```typescript
// ❌ No wallet access
const balance = await getWalletBalance();
const tx = await submitStellarTransaction(payment);

// ✅ Tool handles approval decisions only; payment execution is the caller's concern
```

### Mail Engine

```typescript
// ❌ No inbox access
const emails = await getInboxEmails();
const attachment = email.attachments[0];

// ✅ Payment data is provided directly via props
```

### Database

```typescript
// ❌ No database
const records = await db.payments.findMany();
await db.decisions.create({ ... });

// ✅ In-memory services + optional localStorage (see DATA_OWNERSHIP.md)
```

---

## Forbidden Exports for Main App Consumption

This tool is **not** a shared library. It must not be imported by `src/` today.

```typescript
// ❌ Don't add this tool to main app barrel exports
export { TeamPaymentApprovalTool } from "../../tools/v2/team/team-payment-approval";

// When integration is ready (separate issue), create a wrapper in:
// src/features/team-payment-approval-integration/
// That wrapper imports from this tool and wires it into app routing/auth.
```

---

## Forbidden Patterns

### Global State Crossing

```typescript
// ❌ Don't read main app global state
const mail = useContext(MailAppContext);

// ✅ Create tool-local context if sharing state between tool components
const PaymentApprovalContext = createContext<State | null>(null);
```

### Side Effects Outside the Tool

```typescript
// ❌ Don't trigger main app side effects
useEffect(() => { mainAppStore.notify(decision); }, [decision]);

// ✅ Surface decisions via callbacks to the caller
onApprove(paymentId, notes);
```

### Dynamic Main App Imports

```typescript
// ❌ No dynamic imports from src/
const mod = await import("../../../src/features/" + featureName);
```

---

## Dependency Rules

When you need an external library:

1. **Check `package.json` first** — reuse what's already installed
2. **If not present** — the library must:
   - Be standalone (no conflicts with existing dependencies)
   - Not require changes to `vite.config.ts` or `tsconfig.json`
   - Not add global side effects
3. **Never change** the version of React, Radix UI, Tailwind, or other core deps

---

## Styling Rules

```typescript
// ✅ Tailwind utility classes
// ✅ styles.css (tool-local overrides)
// ✅ Radix UI primitives for accessible structure
// ✅ Design system tokens (read-only, via CSS variables already in scope)

// ❌ Don't add new global CSS variables to the design system
// ❌ Don't override design system tokens
// ❌ Don't modify any file in src/features/design-system/
```

---

## Testing Rules

```typescript
// ✅ Vitest unit tests in tests/unit/
// ✅ Integration tests in tests/integration/
// ✅ Local fixtures from fixtures/
// ✅ Mock localStorage in tests

// ❌ No tests that import from src/
// ❌ No E2E tests that navigate main app routes
// ❌ No real network calls inside tests
```

---

## Exception Process

If you believe a constraint must be broken:

1. **Don't break it quietly** — open a discussion in the PR or issue first
2. **Document the reason** — explain why no alternative exists within boundaries
3. **Create a follow-up integration issue** — the exception belongs there, not here
4. **Get explicit approval** before merging

In practice there should be no exceptions. This tool is designed to be completely self-contained.

---

## Pre-PR Checklist

```
[ ] All changed files are inside tools/v2/team/team-payment-approval/
[ ] No imports from src/ anywhere in the diff
[ ] No new routes added
[ ] No server endpoints added or modified
[ ] No database changes
[ ] No authentication changes
[ ] No wallet or Stellar access
[ ] No mail engine modifications
[ ] No design system files modified
[ ] package.json unchanged (or change explicitly discussed)
[ ] ARCHITECTURE.md updated if module structure changed
[ ] Tests pass locally
[ ] No console errors or warnings
```

---

## Reviewer Checklist

```
[ ] All files changed are within tools/v2/team/team-payment-approval/
[ ] No src/ imports in new code
[ ] Module boundaries respected (see MODULE_BOUNDARIES.md)
[ ] Data ownership respected (see DATA_OWNERSHIP.md)
[ ] New features have tests and fixtures
[ ] Documentation updated
[ ] No main app integration attempted
[ ] Constraints file (this file) still accurate
```
