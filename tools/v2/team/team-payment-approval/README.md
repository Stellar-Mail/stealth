# Team Payment Approval

A self-contained team tool for reviewing and approving payment requests with **accessibility built in**.

## Ownership Boundary

✅ All work for this tool stays inside: `tools/v2/team/team-payment-approval/`

❌ Do NOT modify:

- Main app shell, dashboard, or routing
- Authentication, wallet core, or Stellar integration
- Database schema or API contracts
- Shared design system tokens or components
- Existing inbox architecture or mail rendering

## Folder Structure

```
team-payment-approval/
├── components/          # Accessible UI components
│   ├── payment-approval-form.tsx       # Main approval workflow
│   ├── payment-approval-list.tsx       # Payment request list
│   ├── empty-state.tsx                 # Empty state
│   ├── loading-state.tsx               # Loading state
│   ├── error-state.tsx                 # Error state
│   ├── success-state.tsx               # Success state
│   ├── team-payment-approval-tool.tsx  # Main container
│   └── index.ts
├── hooks/               # Local state management
│   ├── use-payment-approval.ts         # Approval workflow hook
│   ├── use-payment-requests.ts         # Payment fetching hook
│   └── index.ts
├── services/            # Business logic
│   ├── payment.service.ts              # Payment data service
│   ├── decision.service.ts             # Decision recording service
│   └── index.ts
├── types/               # TypeScript definitions
│   ├── payment.ts                      # Payment types
│   └── index.ts
├── fixtures/            # Test data
│   └── payments.fixtures.ts            # Mock payment data
├── tests/               # Unit & integration tests
├── docs/                # Documentation
│   ├── ACCESSIBILITY.md                # Keyboard, screen reader, ARIA
│   ├── VISUAL_STYLE.md                 # Component styles without modifying design system
│   └── README.md                       # Getting started
├── specs.md             # Issue categories and contributor notes
└── README.md            # This file
```

## Key Features

### ✅ Accessibility Built In

- **Keyboard Navigation**: Full Tab/Shift+Tab, Arrow keys, Enter, Escape support
- **Screen Reader Compatible**: Proper ARIA labels, live regions, semantic HTML
- **Focus Management**: Clear focus indicators, logical tab order
- **Color & Contrast**: WCAG AA compliant, status conveyed beyond color
- **Reduced Motion**: Respects `prefers-reduced-motion` preference

See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for detailed keyboard shortcuts and screen reader testing guide.

### 📋 Payment Review Workflow

1. **List View**: Browse pending payments with sort capabilities
2. **Approval Form**: Review payment details, select decision, add notes
3. **Confirmation**: Success state with auto-redirect to list
4. **Error Handling**: Clear error messages with recovery options

### 🎨 Visual Design

- Isolated component styling without modifying shared design system
- Semantic color use (status badges, priority levels)
- Responsive layout from mobile to desktop
- Dark mode support

See [docs/VISUAL_STYLE.md](docs/VISUAL_STYLE.md) for component styling reference.

## Getting Started

### Using the Tool

```tsx
import { TeamPaymentApprovalTool } from "./components/team-payment-approval-tool";
import { mockPayments } from "./fixtures/payments.fixtures";

export function PaymentApprovalPage() {
  return (
    <TeamPaymentApprovalTool
      payments={mockPayments}
      onApprove={async (paymentId, notes) => {
        // Local logic - no main app wiring
        console.log("Approved:", paymentId, notes);
      }}
      onReject={async (paymentId, notes) => {
        // Local logic - no main app wiring
        console.log("Rejected:", paymentId, notes);
      }}
    />
  );
}
```

### Using Components

```tsx
import {
  PaymentApprovalList,
  PaymentApprovalForm,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
} from "./components";
import { mockPayments } from "./fixtures/payments.fixtures";

// Use individual components for custom workflows
```

### Using Hooks

```tsx
import { usePaymentApproval, usePaymentRequests } from "./hooks";

function MyComponent() {
  const { payments, isLoading, fetch } = usePaymentRequests({
    initialPayments: mockPayments,
  });

  const { approve, reject, error } = usePaymentApproval({
    onApprove: async (paymentId, notes) => {
      // Handle approval
    },
  });

  // Build custom UI
}
```

### Using Services

```tsx
import { paymentService, decisionService } from "./services";
import { mockPayments } from "./fixtures/payments.fixtures";

// Add payment to local service
mockPayments.forEach((p) => paymentService.addPayment(p));

// Record decision
decisionService.recordDecision({
  approverId: "user-123",
  paymentId: "payment-1",
  decision: "approve",
  notes: "Approved by manager",
  decidedAt: new Date(),
});

// Query decisions
const decision = decisionService.getDecision("payment-1");
```

### Using the Backend-Facing Execution Contract

The tool also exposes a presentation-independent service entry point for APIs,
tests, and automation. It returns a typed result with stable error codes and
never throws for expected failures. See [CONTRACT.md](CONTRACT.md) for the full
schema and error-code catalog.

```ts
import { paymentApprovalExecutor } from "./services";

const result = paymentApprovalExecutor.execute({
  paymentId: "payment-1",
  approverId: "user-123",
  decision: "approve",
  notes: "Approved by manager",
  context: { approverId: "user-123", role: "manager" },
});

if (result.ok) {
  console.log("status:", result.data.status);
} else {
  console.error(result.error.code); // e.g. "UNAUTHORIZED"
}
```

## Testing

### Local Testing

Use the mock fixtures to test locally:

```tsx
import { mockPayments, getMockPendingPayments } from './fixtures/payments.fixtures';

// Test with all payments
<TeamPaymentApprovalTool payments={mockPayments} />

// Test with specific subset
<TeamPaymentApprovalTool payments={getMockPendingPayments()} />
```

### Accessibility Testing

1. **Keyboard**: Navigate entire tool using Tab, Shift+Tab, Arrows, Enter, Escape
2. **Screen Reader**: Test with NVDA (Windows), VoiceOver (Mac), or Orca (Linux)
3. **Visual**: Check color contrast and focus indicators

See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md#testing-accessibility) for detailed testing guide.

## Contribution Workflow

When contributing to this tool:

1. ✅ Keep all changes in `tools/v2/team/team-payment-approval/`
2. ✅ Test keyboard navigation and screen reader compatibility
3. ✅ Use design system tokens, don't modify shared components
4. ✅ Document changes in relevant docs/
5. ✅ Include local fixtures for new test cases
6. ❌ Don't wire into main app routing, wallet, or auth
7. ❌ Don't modify main app dashboard or navigation

See [specs.md](specs.md) for issue category definitions.

## Next Steps (Future Integration)

When ready to integrate this tool into the main app, a **separate follow-up issue** will handle:

- Routing integration
- Authentication connection
- Main app layout wiring
- Wallet/Stellar connection (if needed)
- Database persistence

For now, this tool is **self-contained with local data handling**.
