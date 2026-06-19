# Team Payment Approval – Module Boundaries

This document defines the internal contract for each module within the Team Payment Approval tool. Future contributors must respect these boundaries when adding or modifying code.

---

## Module: Components

**Location:** `components/`

### Responsibility

Render the payment approval UI. Components are presentational — they delegate all data fetching, business logic, and persistence to hooks and services.

### Public API

```typescript
// team-payment-approval-tool.tsx
export interface TeamPaymentApprovalToolProps {
  payments: PaymentRequest[];
  onApprove: (paymentId: string, notes?: string) => Promise<void>;
  onReject: (paymentId: string, notes?: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}
export const TeamPaymentApprovalTool: React.FC<TeamPaymentApprovalToolProps>;

// payment-approval-list.tsx
export interface PaymentApprovalListProps {
  payments: PaymentRequest[];
  onSelect: (payment: PaymentRequest) => void;
  selectedId?: string;
}
export const PaymentApprovalList: React.FC<PaymentApprovalListProps>;

// payment-approval-form.tsx
export interface PaymentApprovalFormProps {
  payment: PaymentRequest;
  onApprove: (paymentId: string, notes?: string) => Promise<void>;
  onReject: (paymentId: string, notes?: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  error?: string | null;
}
export const PaymentApprovalForm: React.FC<PaymentApprovalFormProps>;

// empty-state.tsx
export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
export const EmptyState: React.FC<EmptyStateProps>;

// loading-state.tsx
export interface LoadingStateProps {
  message?: string;
}
export const LoadingState: React.FC<LoadingStateProps>;

// error-state.tsx
export interface ErrorStateProps {
  title?: string;
  details?: string;
  onRetry?: () => void;
}
export const ErrorState: React.FC<ErrorStateProps>;

// success-state.tsx
export interface SuccessStateProps {
  title?: string;
  details?: string;
  onNext?: () => void;
  autoRedirectMs?: number;
}
export const SuccessState: React.FC<SuccessStateProps>;
```

### Allowed Imports

- Hooks from `hooks/`
- Types from `types/`
- React (`react`)
- Radix UI / Tailwind (styling only — do not wrap for re-export)
- Local `styles.css`

### Forbidden Imports

- Services directly (always go through hooks)
- Main app components or contexts
- Server APIs or routing

### Patterns

- ✅ Accept all data via props
- ✅ Emit events via callback props
- ✅ Use hooks for side effects and state
- ✅ Import types with `import type`
- ❌ Never call services directly
- ❌ Never access localStorage directly
- ❌ Never import from `src/`

---

## Module: Hooks

**Location:** `hooks/`

### Responsibility

Manage component-level state and async side effects. Hooks are the bridge between UI and services.

### Public API

```typescript
// use-payment-approval.ts
export interface UsePaymentApprovalOptions {
  onApprove?: (paymentId: string, notes?: string) => Promise<void>;
  onReject?: (paymentId: string, notes?: string) => Promise<void>;
}
export function usePaymentApproval(options: UsePaymentApprovalOptions): {
  approve: (paymentId: string, notes?: string) => Promise<void>;
  reject: (paymentId: string, notes?: string) => Promise<void>;
  getDecision: (paymentId: string) => ApprovalDecision | undefined;
  clearError: () => void;
  isLoading: boolean;
  error: string | null;
  decisions: Map<string, ApprovalDecision>;
};

// use-payment-requests.ts
export interface UsePaymentRequestsOptions {
  initialPayments?: PaymentRequest[];
  fetchFn?: () => Promise<PaymentRequest[]>;
}
export function usePaymentRequests(options: UsePaymentRequestsOptions): {
  payments: PaymentRequest[];
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
  filterByStatus: (status: ApprovalStatus) => PaymentRequest[];
  filterByPriority: (priority: PaymentPriority) => PaymentRequest[];
};
```

### Allowed Imports

- Services from `services/`
- Types from `types/`
- React hooks (`useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`)

### Forbidden Imports

- Components
- Main app hooks, stores, or contexts
- `src/` anything

### Patterns

- ✅ Export plain hook functions, not classes
- ✅ Return objects with named properties
- ✅ Wrap all async service calls with try/catch
- ✅ Surface `isLoading` and `error` for every async operation
- ❌ Don't call other hooks that aren't in this folder
- ❌ Don't hold component-level refs for DOM nodes (pass to components via props)

---

## Module: Services

**Location:** `services/`

### Responsibility

Stateless business logic and local data persistence. Services have no React dependency.

### Public API

```typescript
// payment.service.ts
class PaymentService {
  addPayment(payment: PaymentRequest): void;
  getPayment(id: string): PaymentRequest | undefined;
  getAllPayments(): PaymentRequest[];
  getPendingPayments(): PaymentRequest[];
  updatePaymentStatus(id: string, status: ApprovalStatus): PaymentRequest | undefined;
  createWorkflow(paymentId: string, requiredApprovals?: number): ApprovalWorkflow;
  clear(): void;
}
export const paymentService: PaymentService;

// decision.service.ts
class DecisionService {
  recordDecision(decision: ApprovalDecision): void;
  getDecision(paymentId: string): ApprovalDecision | undefined;
  getAllDecisions(): ApprovalDecision[];
  getApprovalCount(): number;
  getRejectionCount(): number;
  clear(): void;
}
export const decisionService: DecisionService;           // in-memory only
export const persistentDecisionService: DecisionService; // + localStorage
```

### Storage Contracts

- `paymentService` — in-memory `Map<string, PaymentRequest>`; cleared on page reload
- `decisionService` — in-memory `Map<string, ApprovalDecision>`; cleared on page reload
- `persistentDecisionService` — localStorage key: `team-payment-approval:decisions`

All localStorage keys **must** be prefixed with `team-payment-approval:` to avoid collisions.

### Allowed Imports

- Types from `types/`
- Native browser APIs (`localStorage`, `Map`)

### Forbidden Imports

- React or React hooks
- Components or hooks
- Main app services, database, or API

### Patterns

- ✅ Singleton instances exported for reuse
- ✅ Pure methods: accept parameters, return typed results
- ✅ Explicit error handling with meaningful messages
- ✅ All public methods documented with JSDoc
- ❌ Never use React hooks inside services
- ❌ Never reach outside the tool boundary for data

---

## Module: Types

**Location:** `types/`

### Responsibility

Centralized TypeScript definitions. No runtime code.

### Exports

```typescript
// Primitive unions
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type PaymentPriority = "low" | "normal" | "high" | "urgent";

// Entities
export interface PaymentRequest {
  id: string;
  recipient: string;
  amount: number;
  currency: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  deadline?: Date;
  priority: PaymentPriority;
  status: ApprovalStatus;
  notes?: string;
}

export interface PaymentApprover {
  id: string;
  name: string;
  email: string;
  role: string;
  approvalLimit?: number;
}

export interface ApprovalDecision {
  approverId: string;
  paymentId: string;
  decision: "approve" | "reject";
  notes?: string;
  decidedAt: Date;
}

export interface ApprovalWorkflow {
  id: string;
  paymentId: string;
  status: "pending" | "completed" | "escalated";
  requiredApprovals: number;
  approvals: ApprovalDecision[];
  rejections: ApprovalDecision[];
  createdAt: Date;
  completedAt?: Date;
}
```

### Constraints

- ✅ Type and interface definitions only
- ✅ JSDoc comments on all exported types
- ❌ No runtime code, class instances, or function bodies
- ❌ No imports from components, services, or hooks

---

## Module: Fixtures

**Location:** `fixtures/`

### Responsibility

Local mock data for development, demos, and testing. Never used in production.

### Public API

```typescript
export const mockPayments: PaymentRequest[];          // All mock payments
export const completedPayments: PaymentRequest[];     // Approved/rejected examples
export function getMockPayment(id: string): PaymentRequest | undefined;
export function getMockPendingPayments(): PaymentRequest[];
export function getMockPaymentsByPriority(priority: PaymentPriority): PaymentRequest[];
```

### Constraints

- ✅ All data stays local — never fetched from a server
- ✅ Cover all `ApprovalStatus` and `PaymentPriority` combinations
- ✅ Use realistic names, amounts, and descriptions
- ❌ No real personal data
- ❌ No imports from services or hooks

---

## Module: Tests

**Location:** `tests/`

### Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── payment.service.spec.ts
│   │   └── decision.service.spec.ts
│   ├── hooks/
│   │   ├── use-payment-approval.spec.ts
│   │   └── use-payment-requests.spec.ts
│   └── components/
│       ├── payment-approval-list.spec.tsx
│       └── payment-approval-form.spec.tsx
└── integration/
    └── approval-workflow.spec.ts
```

### Patterns

- ✅ Vitest for all unit and integration tests
- ✅ Mock localStorage for service tests
- ✅ Mock service responses for hook tests
- ✅ Use fixtures from `fixtures/` — never invent inline test data
- ✅ Test happy path and error/edge cases separately
- ❌ No imports from `src/`
- ❌ No real network calls

---

## Dependency Checklist

Before adding any import, verify:

- [ ] Source is within `tools/v2/team/team-payment-approval/` **or** an allowed external library
- [ ] Module dependency graph is not violated (see ARCHITECTURE.md)
- [ ] No circular dependencies introduced
- [ ] Types-only imports use `import type`
- [ ] No `src/` path appears anywhere in the diff

---

## Adding a New Module

If a new module is genuinely needed:

1. Open an issue or PR comment — explain why no existing module fits
2. Define its responsibility in one sentence
3. Document its public API here before writing code
4. Follow the patterns of existing modules
5. Update `ARCHITECTURE.md` dependency graph
