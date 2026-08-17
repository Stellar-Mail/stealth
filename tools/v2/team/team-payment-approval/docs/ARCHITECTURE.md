# Team Payment Approval Tool - Architecture

This document describes the architecture and design patterns used in the Team Payment Approval tool.

## Overview

The Team Payment Approval tool is a **self-contained, isolated tool** for reviewing and approving payment requests. It operates independently with local data services and does not depend on the main application.

## Architecture Diagram

```
┌─ User Interface Layer ─────────────────────────┐
│                                                 │
│  TeamPaymentApprovalTool (Main Container)      │
│  ├─ PaymentApprovalList (Browse view)         │
│  ├─ PaymentApprovalForm (Review view)         │
│  └─ State Components                           │
│      ├─ EmptyState                            │
│      ├─ LoadingState                          │
│      ├─ ErrorState                            │
│      └─ SuccessState                          │
│                                                │
└─────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─ State Management ────────────────────────────┐
│                                                │
│  Custom Hooks                                 │
│  ├─ usePaymentApproval (workflow state)       │
│  └─ usePaymentRequests (data fetching)        │
│                                                │
└─────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─ Business Logic Layer ─────────────────────────┐
│                                                │
│  Services (Local Data Management)             │
│  ├─ PaymentService (payment CRUD)            │
│  └─ DecisionService (approval decisions)      │
│                                                │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─ Data Layer ───────────────────────────────────┐
│                                                │
│  In-Memory Storage (+ Optional localStorage)   │
│  ├─ Payment requests                          │
│  ├─ Approval decisions                        │
│  └─ Workflow state                            │
│                                                │
└─────────────────────────────────────────────────┘

┌─ Test Fixtures & Documentation ────────────────┐
│                                                │
│  ├─ Mock payment data                         │
│  ├─ Accessibility guide                       │
│  ├─ Visual style guide                        │
│  └─ Getting started guide                     │
│                                                │
└─────────────────────────────────────────────────┘
```

## Component Structure

### UI Components (`components/`)

#### TeamPaymentApprovalTool

- **Purpose**: Main container orchestrating the entire workflow
- **State**: Current view (list/reviewing/loading/error/success)
- **Props**: `payments`, `onApprove`, `onReject`, `isLoading`, `error`
- **Responsibility**: Managing view transitions, handling focus management

#### PaymentApprovalList

- **Purpose**: Display sortable list of pending payments
- **Features**:
  - Keyboard navigation (arrow keys)
  - Row selection with visual feedback
  - Sortable columns
  - Status badges with accessible labels
- **Accessibility**: ARIA table semantics, keyboard support

#### PaymentApprovalForm

- **Purpose**: Display payment details and capture approval decision
- **Features**:
  - Payment details display
  - Radio button decision selection
  - Optional notes field
  - Form validation
  - Keyboard shortcuts (Escape to cancel, Ctrl+Enter to submit)
- **Accessibility**: Proper label associations, fieldset for grouping, keyboard support

#### State Components

- **EmptyState**: No payments to review
- **LoadingState**: Fetching data (aria-live="polite" for updates)
- **ErrorState**: Error occurred (role="alert" for immediate announcement)
- **SuccessState**: Confirmation after action (aria-live="assertive")

### Custom Hooks (`hooks/`)

#### usePaymentApproval

- **Purpose**: Manage approval workflow state
- **Methods**:
  - `approve(paymentId, notes)`: Record approval decision
  - `reject(paymentId, notes)`: Record rejection decision
  - `getDecision(paymentId)`: Retrieve stored decision
  - `clearError()`: Clear error state
- **State**: `isLoading`, `error`, `decisions`

#### usePaymentRequests

- **Purpose**: Fetch and manage payment data
- **Methods**:
  - `fetch()`: Fetch data from provided callback
  - `refresh()`: Force refresh
  - `filterByStatus()`: Filter by status
  - `filterByPriority()`: Filter by priority
- **State**: `payments`, `isLoading`, `error`

### Services (`services/`)

#### PaymentService

- **Singleton**: Single instance across application
- **Methods**:
  - `addPayment()`: Store payment request
  - `getPayment()`: Retrieve by ID
  - `getAllPayments()`: Get all payments
  - `getPendingPayments()`: Filter pending only
  - `updatePaymentStatus()`: Change payment status
  - `createWorkflow()`: Create approval workflow
- **Storage**: In-memory Map

#### DecisionService

- **Singleton**: Two instances available
  - `decisionService`: In-memory only
  - `persistentDecisionService`: With localStorage
- **Methods**:
  - `recordDecision()`: Store decision
  - `getDecision()`: Retrieve decision
  - `getApprovalCount()`: Count approvals
  - `getRejectionCount()`: Count rejections
  - `clear()`: Reset storage
- **Storage**: In-memory Map (optional localStorage)

### Type Definitions (`types/`)

```typescript
// Payment request
interface PaymentRequest {
  id: string;
  recipient: string;
  amount: number;
  currency: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  deadline?: Date;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "approved" | "rejected" | "expired";
  notes?: string;
}

// Approval decision
interface ApprovalDecision {
  approverId: string;
  paymentId: string;
  decision: "approve" | "reject";
  notes?: string;
  decidedAt: Date;
}

// Approval workflow
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

## Data Flow

### Payment Approval Workflow

```
1. User views PaymentApprovalList
   ├─ usePaymentRequests fetches payments
   ├─ PaymentService stores in memory
   └─ List displays with status badges

2. User selects payment from list
   ├─ Focus moves to PaymentApprovalForm
   ├─ Payment details displayed
   └─ Form ready for decision

3. User makes decision (approve/reject)
   ├─ Radio button selected
   ├─ Optional notes entered
   └─ Form validates

4. User confirms decision
   ├─ usePaymentApproval.approve() or reject() called
   ├─ DecisionService records decision
   ├─ onApprove/onReject callback invoked
   └─ View transitions to SuccessState

5. Success shown, auto-redirect after 3 seconds
   ├─ View returns to PaymentApprovalList
   ├─ Selected payment cleared
   └─ Pending list refreshed
```

## Accessibility Architecture

### Keyboard Navigation

- **Tab**: Move between interactive elements
- **Shift+Tab**: Move backward
- **Arrow Keys**: Navigate list rows
- **Enter/Space**: Activate elements
- **Escape**: Cancel operations

Implementation through:

- Native HTML form controls (button, input, textarea)
- OnKeyDown handlers for custom navigation
- Ref management for focus control

### Screen Reader Support

- **Semantic HTML**: form, fieldset, legend, table, thead, tbody
- **ARIA Labels**: aria-label, aria-labelledby, aria-describedby
- **Live Regions**: role="status" with aria-live="polite"/"assertive"
- **Status Indicators**: role="alert" for errors

### Visual Accessibility

- **Focus Indicators**: Visible ring with offset
- **Color Contrast**: WCAG AA minimum (4.5:1)
- **Reduced Motion**: Respects prefers-reduced-motion

## Styling Strategy

### Design System Integration

- Uses existing design system tokens (colors, spacing, typography)
- Tailwind CSS for component styling
- No modifications to shared design system

### Component Styles

- Status badges with semantic colors
- Priority indicators with color + text
- Form fields with accessible styling
- Focus indicators on all interactive elements
- Dark mode support with dark: prefix

### Responsive Design

- Mobile-first approach
- Tablet breakpoints (md: 768px)
- Desktop layout (lg: 1024px)
- Table responds on mobile

## State Management Pattern

### Local State

- Component-level state with useState
- Hook-based state management (custom hooks)
- No external state library required

### Service State

- Singleton services for data
- In-memory storage by default
- Optional localStorage for persistence

### Flow

```
User Action (onClick, onKeyDown)
    ↓
Event Handler
    ↓
State Update (useState/hook)
    ↓
Component Re-render
    ↓
UI Update
```

## Testing Strategy

### Unit Tests

- Component rendering
- State changes
- Event handling
- Keyboard navigation

### Integration Tests

- Full workflow (list → form → approval)
- State persistence
- Error handling

### Accessibility Tests

- Keyboard navigation
- Screen reader compatibility
- Color contrast
- Focus management

### Test Fixtures

- Mock payment data in `fixtures/`
- Various priority and status combinations
- Realistic names and amounts

## Boundary Conditions

### What's Inside This Tool

✅ UI components for payment review
✅ Local data services
✅ State management hooks
✅ Mock fixtures
✅ Accessibility features
✅ Documentation

### What's NOT Inside This Tool

❌ Main app routing
❌ Authentication system
❌ Wallet integration
❌ Stellar blockchain integration
❌ Inbox or mail rendering
❌ Database persistence
❌ API endpoints

## Extension Points

For future integration, external code can:

- Provide custom payment data via props
- Implement approval/rejection callbacks
- Add filtering or sorting logic
- Custom styling (CSS classes)
- Additional state management

But CANNOT:

- Modify shared design system
- Wire into main app routing
- Access wallet or Stellar core
- Modify database schema
- Change authentication

## Performance Considerations

### Optimization

- Memoization of components (React.memo if needed)
- Efficient re-renders with proper key usage
- Lazy loading of large lists (if needed)
- Service singletons prevent duplicate data

### Limitations

- In-memory storage limited by browser memory
- localStorage limited to ~5-10MB
- No server-side pagination or filtering
- No real-time updates

## Security Considerations

### What's NOT a Security Concern

- This is a local demo/testing tool
- No real payment processing
- No real credentials or tokens
- No database access

### Input Validation

- Form validation for required fields
- Type checking with TypeScript
- Notes field sanitized before display

### Future Considerations

- When integrated with real API, add authentication
- Validate permissions server-side
- Audit log all approval decisions
- Rate limit approval endpoints

## Future Enhancements

Phase 2 (Testing & Documentation):

- Unit tests with Vitest
- E2E tests with Playwright
- Expanded documentation

Phase 3 (Integration):

- Route integration with main app
- Authentication connection
- Real API integration
- Database persistence
- Audit logging

---

This architecture ensures the tool is **isolated, maintainable, testable, and accessible** while remaining ready for future integration.
