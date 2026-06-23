# Team Payment Approval – Architecture Contract

## Overview

The Team Payment Approval tool is a self-contained, isolated mini-product that lets team members review and approve (or reject) payment requests entirely within its own folder boundary.

**Release Tier:** V2 Later  
**Audience:** Team  
**Status:** Isolated workspace — not yet wired to main app  
**Folder:** `tools/v2/team/team-payment-approval/`

---

## Ownership Boundary

All code, components, services, hooks, tests, fixtures, documentation, and styles **must remain exclusively within**:

```
tools/v2/team/team-payment-approval/
```

No other part of the codebase should import from this folder, and this tool must not import from core application infrastructure.

---

## Folder Structure

```
team-payment-approval/
├── ARCHITECTURE.md              ← This file (root architecture contract)
├── MODULE_BOUNDARIES.md         ← Internal module contracts
├── DATA_OWNERSHIP.md            ← Data flow and ownership
├── INTEGRATION_CONSTRAINTS.md   ← Hard boundaries for contributors
├── CONTRIBUTOR_GUIDE.md         ← How to extend this tool
├── DELIVERY.md                  ← Delivery summary
├── README.md                    ← Getting started
├── specs.md                     ← Issue categories and acceptance criteria
├── index.ts                     ← Public API exports
├── demo.tsx                     ← Demo and usage examples
├── styles.css                   ← Component-local styles
│
├── components/                  ← Accessible React UI components
│   ├── payment-approval-form.tsx       # Approve / reject form
│   ├── payment-approval-list.tsx       # Sortable payment list
│   ├── empty-state.tsx                 # No payments
│   ├── loading-state.tsx               # Fetching data
│   ├── error-state.tsx                 # Error occurred
│   ├── success-state.tsx               # Action confirmed
│   ├── team-payment-approval-tool.tsx  # Main container
│   └── index.ts                        # Component exports
│
├── hooks/                       ← Local state management
│   ├── use-payment-approval.ts         # Approval workflow hook
│   ├── use-payment-requests.ts         # Data fetching hook
│   └── index.ts
│
├── services/                    ← Business logic (no external deps)
│   ├── payment.service.ts              # Payment CRUD
│   ├── decision.service.ts             # Decision recording
│   └── index.ts
│
├── types/                       ← TypeScript definitions
│   ├── payment.ts
│   └── index.ts
│
├── fixtures/                    ← Local test/demo data
│   └── payments.fixtures.ts
│
├── tests/                       ← Unit and integration tests
│
└── docs/                        ← Local documentation
    ├── ACCESSIBILITY.md
    ├── ARCHITECTURE.md          ← Detailed design notes (internal)
    ├── GETTING_STARTED.md
    └── VISUAL_STYLE.md
```

---

## Module Definitions

### 1. Components (`components/`)

**Responsibility:** Present the payment approval UI. Components are purely presentational — all state and business logic lives in hooks and services.

**Key components:**

| Component | Role |
|-----------|------|
| `TeamPaymentApprovalTool` | Main container; manages view state and focus transitions |
| `PaymentApprovalList` | Sortable, keyboard-navigable list of payment requests |
| `PaymentApprovalForm` | Detail view with approve/reject decision and notes |
| `EmptyState` | Displayed when no payments are pending |
| `LoadingState` | Skeleton UI while data loads |
| `ErrorState` | Immediate role="alert" announcement on failure |
| `SuccessState` | Confirmation with optional auto-redirect |

**Allowed imports:** hooks, types, local styles, React, Radix UI (styling only)  
**Forbidden imports:** services (use hooks), main app components, server APIs

### 2. Hooks (`hooks/`)

**Responsibility:** Bridge components and services. Encapsulate state, async lifecycle, and error handling.

| Hook | Role |
|------|------|
| `usePaymentApproval` | Approval workflow: approve(), reject(), clearError() |
| `usePaymentRequests` | Fetch, filter, and refresh payment list |

**Allowed imports:** services, types, React hooks  
**Forbidden imports:** components, main app hooks/services

### 3. Services (`services/`)

**Responsibility:** Stateless business logic and local data persistence.

| Service | Role |
|---------|------|
| `paymentService` | In-memory CRUD for PaymentRequest objects |
| `decisionService` | In-memory ApprovalDecision storage |
| `persistentDecisionService` | localStorage-backed DecisionService variant |

**Allowed imports:** types  
**Forbidden imports:** React, components, main app code

### 4. Types (`types/`)

**Responsibility:** TypeScript definitions only — no runtime code.

```typescript
PaymentRequest     // id, recipient, amount, currency, status, priority, …
PaymentApprover    // id, name, email, role, approvalLimit
ApprovalDecision   // approverId, paymentId, decision, notes, decidedAt
ApprovalWorkflow   // id, paymentId, status, approvals, rejections, …
ApprovalStatus     // "pending" | "approved" | "rejected" | "expired"
PaymentPriority    // "low" | "normal" | "high" | "urgent"
```

### 5. Fixtures (`fixtures/`)

**Responsibility:** Local mock data for testing and demos.

- 6 mock pending payments across all priority levels
- 2 completed examples (approved / rejected)
- Helper functions: `getMockPayment()`, `getMockPendingPayments()`, `getMockPaymentsByPriority()`

---

## Dependency Graph

```
Components
  └── Hooks
       └── Services
            └── Types
                └── (no dependencies)

Utils / Fixtures
  └── Types

Tests
  └── All modules (read-only)
```

**Rule:** No circular dependencies allowed.

---

## Data Flow

```
User Action
    ↓
Component event handler
    ↓
Hook method (approve / reject / fetch)
    ↓
Service call (paymentService / decisionService)
    ↓
In-memory Map  →  (optional) localStorage
    ↓
State update → component re-render
```

See `DATA_OWNERSHIP.md` for full lifecycle and storage ownership details.

---

## Accessibility Architecture

- **Keyboard:** Full Tab / Shift+Tab, Arrow keys, Enter, Escape, Ctrl+Enter
- **Screen reader:** Semantic HTML (form, fieldset, table), ARIA labels, live regions
- **Visual:** WCAG AA contrast, visible focus rings, reduced motion support

See `docs/ACCESSIBILITY.md` for the full guide.

---

## Styling Strategy

- Tailwind utility classes scoped to tool components
- `styles.css` provides component-local overrides
- Design system tokens used without modification
- No shared design system files altered
- Dark mode via Tailwind `dark:` prefix

See `docs/VISUAL_STYLE.md` for reference.

---

## Boundary Conditions

### Inside This Tool ✅

- All UI components
- Local data services (in-memory, optional localStorage)
- State management hooks
- Mock fixtures and test helpers
- Accessibility features
- All documentation

### Outside This Tool ❌

- Main app shell, routing, navigation
- Authentication and authorization
- Wallet core and Stellar integration
- Inbox and mail rendering engine
- Database schema and server API
- Shared design system tokens

---

## Success Criteria

The architecture contract is complete when:

1. Module boundaries are clearly defined (see `MODULE_BOUNDARIES.md`)
2. Data ownership is documented (see `DATA_OWNERSHIP.md`)
3. Integration constraints are explicit (see `INTEGRATION_CONSTRAINTS.md`)
4. Folder structure matches specification
5. Internal architecture can be understood by a new contributor in < 10 minutes
6. No code exists outside `tools/v2/team/team-payment-approval/`
7. No imports from `src/` exist
8. Zero modifications to core app files
9. Tool is reviewable as a self-contained mini-product

---

## References

- [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) — Module-level contracts
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) — Data flow and storage ownership
- [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) — Hard boundaries
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) — How to contribute
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Detailed design notes
- [docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) — Keyboard and screen reader guide
