# Team Payment Approval – Data Ownership & Flow

This document defines how data enters, moves through, and is stored within the Team Payment Approval tool. All data stays client-side and within this tool's boundary.

---

## Data Model

### Core Entities

```typescript
// A payment request submitted for team approval
interface PaymentRequest {
  id: string;           // Unique ID (e.g. "pay-001")
  recipient: string;    // Recipient name or address
  amount: number;       // Numeric amount
  currency: string;     // e.g. "USD", "XLM"
  description: string;  // Purpose of the payment
  requestedBy: string;  // Name of the requester
  requestedAt: Date;    // Submission timestamp
  deadline?: Date;      // Optional approval deadline
  priority: PaymentPriority;  // "low" | "normal" | "high" | "urgent"
  status: ApprovalStatus;     // "pending" | "approved" | "rejected" | "expired"
  notes?: string;       // Optional context from requester
}

// A recorded approval or rejection
interface ApprovalDecision {
  approverId: string;   // ID of the approver
  paymentId: string;    // Reference to PaymentRequest.id
  decision: "approve" | "reject";
  notes?: string;       // Approver's notes
  decidedAt: Date;      // Decision timestamp
}

// Tracks the full approval lifecycle of one payment
interface ApprovalWorkflow {
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

---

## Data Lifecycle

### Phase 1 — Payment Data Loaded

```
Caller provides payments[] via props
        ↓
TeamPaymentApprovalTool receives PaymentRequest[]
        ↓
usePaymentRequests initialises local state
        ↓
paymentService.addPayment() called for each entry
        ↓
Payments stored in-memory Map
```

**Owner:** Caller (passed as props)  
**Storage:** In-memory `paymentService` Map  
**Constraint:** Tool never fetches payments from a remote API on its own

---

### Phase 2 — User Reviews a Payment

```
User selects a row in PaymentApprovalList
        ↓
TeamPaymentApprovalTool sets selectedPayment state
        ↓
PaymentApprovalForm renders payment details
        ↓
No new data written yet
```

**Owner:** Component state (React useState)  
**Storage:** Browser memory only  
**Constraint:** Read-only phase — no mutations

---

### Phase 3 — User Submits Decision

```
User selects approve / reject + optional notes
        ↓
PaymentApprovalForm calls onApprove() / onReject()
        ↓
usePaymentApproval.approve() / reject() invoked
        ↓
decisionService.recordDecision() called
        ↓
ApprovalDecision stored in-memory Map
        ↓ (if persistentDecisionService used)
localStorage.setItem("team-payment-approval:decisions", …)
        ↓
onApprove / onReject prop callback invoked (caller handles persistence)
```

**Owner:** `decisionService` (in-memory) or `persistentDecisionService` (localStorage)  
**Storage:** See Storage Schema below  
**Constraint:** The tool records decisions locally; durable persistence is the caller's responsibility via callbacks

---

### Phase 4 — Success Confirmation

```
Hook resolves → isLoading = false, no error
        ↓
TeamPaymentApprovalTool transitions to SuccessState
        ↓
Auto-redirects to list after 3 seconds (configurable)
        ↓
Selected payment cleared from component state
```

**Owner:** Component state  
**Storage:** None (ephemeral UI state)

---

## Storage Schema

### In-Memory (default)

Both `paymentService` and `decisionService` use `Map` objects that live in the JavaScript heap for the lifetime of the page.

```
paymentService.payments     Map<string, PaymentRequest>
decisionService.decisions   Map<string, ApprovalDecision>
```

Cleared on page reload. No persistence beyond the session.

### localStorage (opt-in)

`persistentDecisionService` writes to localStorage when used in place of `decisionService`.

```
Key:    "team-payment-approval:decisions"
Value:  JSON.stringify(ApprovalDecision[])
```

All keys owned by this tool use the prefix `team-payment-approval:` to avoid collisions with the main app or other tools.

---

## Data Ownership Map

| Data | Owner | Location | Mutated By | Constraint |
|------|-------|----------|------------|------------|
| `PaymentRequest[]` (initial) | Caller (props) | Component state + paymentService Map | paymentService.updatePaymentStatus() | Read from props; local status updates only |
| `ApprovalDecision` | decisionService | In-memory Map | decisionService.recordDecision() | One decision per paymentId |
| Persisted decisions | persistentDecisionService | localStorage | persistentDecisionService.recordDecision() | JSON-serialised; tool-prefixed key |
| Selected payment | Component state | React useState | User row selection | Ephemeral; cleared on success or cancel |
| View state | Component state | React useState | View transitions | Ephemeral; list / reviewing / loading / error / success |
| Approval workflow | paymentService | In-memory Map | paymentService.createWorkflow() | Derived; not persisted by default |

---

## Data Flow Diagram

```
 Caller
   │  payments[] (props)
   │  onApprove() / onReject() (callbacks)
   ▼
┌──────────────────────────────────┐
│  TeamPaymentApprovalTool         │
│  (view state, selected payment)  │
└──────┬────────────────┬──────────┘
       │                │
       ▼                ▼
┌─────────────┐  ┌───────────────────┐
│ PaymentList │  │ PaymentApproval   │
│  (display)  │  │ Form (decision)   │
└──────┬──────┘  └────────┬──────────┘
       │                  │
       ▼                  ▼
┌──────────────────────────────────┐
│  Hooks                           │
│  usePaymentRequests              │
│  usePaymentApproval              │
└──────┬────────────────┬──────────┘
       │                │
       ▼                ▼
┌─────────────┐  ┌────────────────────┐
│ paymentSvc  │  │ decisionService    │
│ (in-memory) │  │ (in-mem / lStore)  │
└─────────────┘  └────────────────────┘
```

---

## Who Can Access Data

### Within This Tool ✅

- Components read data from hooks via props/return values
- Hooks read and write data through services
- Services read and write in-memory Maps and (optionally) localStorage
- Tests can mock any layer and inspect state directly
- Fixtures provide read-only seed data

### Outside This Tool ❌

- The main app **cannot** read this tool's localStorage keys
- The main app **cannot** import or call tool services directly
- The tool **cannot** read main app data stores, auth state, or wallet state
- No external API receives data from this tool without an explicit integration issue

---

## Mutability Rules

| Data | Mutable? | Rules |
|------|----------|-------|
| `PaymentRequest` (loaded) | Status only | `updatePaymentStatus()` is the sole mutation path |
| `ApprovalDecision` | Immutable after creation | Recorded once; no update method |
| `ApprovalWorkflow` | Status + completedAt | Updated on completion only |
| Component state | Yes | Via React `useState` setters inside tool only |
| localStorage | Yes (append/replace) | Entire key replaced on each write |

Services return **new objects** and never mutate function parameters.

---

## Data Security Notes

**Current scope (isolated tool):**

- All data lives in the browser; nothing is transmitted over the network
- No real payment credentials, wallet keys, or Stellar transactions are involved
- localStorage data is subject to the browser's same-origin policy
- Tool key prefix prevents accidental collision with main app storage

**Future considerations (integration issue):**

When this tool is wired to the main app in a separate issue, consider:

- Whether decisions should be synced server-side and associated with a user account
- Whether an audit log should replace or supplement localStorage
- Whether amounts and recipients need encryption at rest
- What the data retention policy is for completed decisions

These decisions belong in the integration issue, not here.

---

## Storage Key Reference

```typescript
// All localStorage keys used by this tool:
const STORAGE_KEYS = {
  decisions: "team-payment-approval:decisions",  // ApprovalDecision[]
  // Add future keys here with description
} as const;
```

**Rule:** Every key must start with `team-payment-approval:`.
