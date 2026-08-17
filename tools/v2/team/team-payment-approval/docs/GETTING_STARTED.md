# Team Payment Approval Tool - Getting Started

This guide walks you through using the Team Payment Approval tool in your application.

## Installation

The tool is already part of the codebase at `tools/v2/team/team-payment-approval/`. No additional installation needed.

## Basic Usage

### Using the Main Component

The simplest way to use the tool is with the `TeamPaymentApprovalTool` component:

```tsx
import { TeamPaymentApprovalTool } from "@/tools/v2/team/team-payment-approval";
import { mockPayments } from "@/tools/v2/team/team-payment-approval/fixtures/payments.fixtures";

export function PaymentApprovalPage() {
  return (
    <TeamPaymentApprovalTool
      payments={mockPayments}
      onApprove={async (paymentId, notes) => {
        // Handle approval
        console.log(`Approved payment ${paymentId}`);
        console.log(`Notes: ${notes}`);
      }}
      onReject={async (paymentId, notes) => {
        // Handle rejection
        console.log(`Rejected payment ${paymentId}`);
        console.log(`Notes: ${notes}`);
      }}
    />
  );
}
```

### Using Individual Components

For more control, use components separately:

```tsx
import {
  PaymentApprovalList,
  PaymentApprovalForm,
  EmptyState,
  LoadingState,
} from "@/tools/v2/team/team-payment-approval/components";
import { mockPayments } from "@/tools/v2/team/team-payment-approval/fixtures/payments.fixtures";
import { useState } from "react";

export function CustomApprovalPage() {
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!mockPayments.length) {
    return (
      <EmptyState
        title="No payments to review"
        description="Check back later for pending approvals"
      />
    );
  }

  if (selected) {
    return (
      <PaymentApprovalForm
        payment={selected}
        onApprove={async (notes) => {
          // Handle approval
          setSelected(null);
        }}
        onReject={async (notes) => {
          // Handle rejection
          setSelected(null);
        }}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return <PaymentApprovalList payments={mockPayments} onSelectPayment={setSelected} />;
}
```

## Using Hooks

For advanced state management, use the provided hooks:

### usePaymentRequests

Manage fetching and filtering payments:

```tsx
import { usePaymentRequests } from "@/tools/v2/team/team-payment-approval/hooks";
import { mockPayments } from "@/tools/v2/team/team-payment-approval/fixtures/payments.fixtures";

function MyComponent() {
  const { payments, isLoading, error, filterByStatus, filterByPriority, refresh } =
    usePaymentRequests({
      initialPayments: mockPayments,
    });

  const urgentPayments = filterByPriority("urgent");
  const pendingPayments = filterByStatus("pending");

  return (
    <div>
      <h2>Pending Payments: {pendingPayments.length}</h2>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### usePaymentApproval

Manage approval decisions:

```tsx
import { usePaymentApproval } from "@/tools/v2/team/team-payment-approval/hooks";

function ApprovalForm({ paymentId }) {
  const { isLoading, error, approve, reject, getDecision, clearError } = usePaymentApproval({
    onApprove: async (paymentId, notes) => {
      // Handle approval
      console.log(`Approved ${paymentId}`);
    },
  });

  const decision = getDecision(paymentId);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await approve(paymentId, "My notes");
        } catch (err) {
          // Error handled by hook
        }
      }}
    >
      {error && (
        <div>
          Error: {error}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      {decision && <p>Already decided: {decision.decision}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Processing..." : "Approve"}
      </button>
    </form>
  );
}
```

## Using Services

For direct data management:

```tsx
import { paymentService, decisionService } from "@/tools/v2/team/team-payment-approval/services";
import { mockPayments } from "@/tools/v2/team/team-payment-approval/fixtures/payments.fixtures";

// Initialize with mock data
mockPayments.forEach((p) => paymentService.addPayment(p));

// Get pending payments
const pending = paymentService.getPendingPayments();

// Record a decision
decisionService.recordDecision({
  approverId: "user-123",
  paymentId: "payment-1",
  decision: "approve",
  notes: "Looks good",
  decidedAt: new Date(),
});

// Check decision stats
console.log("Approvals:", decisionService.getApprovalCount());
console.log("Rejections:", decisionService.getRejectionCount());

// Update payment status
paymentService.updatePaymentStatus("payment-1", "approved");
```

## Testing

### Unit Testing Example

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentApprovalForm } from "@/tools/v2/team/team-payment-approval/components";
import { mockPayments } from "@/tools/v2/team/team-payment-approval/fixtures/payments.fixtures";

describe("PaymentApprovalForm", () => {
  it("should approve a payment with notes", async () => {
    const handleApprove = jest.fn();
    const payment = mockPayments[0];

    render(
      <PaymentApprovalForm
        payment={payment}
        onApprove={handleApprove}
        onReject={() => {}}
        onCancel={() => {}}
      />,
    );

    // Select approve
    const approveButton = screen.getByLabelText(/approve/i);
    await userEvent.click(approveButton);

    // Add notes
    const notesField = screen.getByPlaceholderText(/comments/i);
    await userEvent.type(notesField, "Approved by manager");

    // Submit
    const submitButton = screen.getByRole("button", { name: /confirm/i });
    await userEvent.click(submitButton);

    expect(handleApprove).toHaveBeenCalledWith("Approved by manager");
  });
});
```

### Accessibility Testing

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentApprovalTool } from "@/tools/v2/team/team-payment-approval";
import { mockPayments } from "@/tools/v2/team/team-payment-approval/fixtures/payments.fixtures";

describe("Accessibility", () => {
  it("should be keyboard navigable", async () => {
    render(
      <PaymentApprovalTool payments={mockPayments} onApprove={jest.fn()} onReject={jest.fn()} />,
    );

    // Tab to first payment
    await userEvent.tab();
    expect(screen.getByRole("row", { selected: true })).toBeInTheDocument();

    // Arrow down to next payment
    await userEvent.keyboard("{ArrowDown}");
    // Focus should move to next row

    // Enter to select
    await userEvent.keyboard("{Enter}");
    // Form should appear
    expect(screen.getByRole("form")).toBeInTheDocument();

    // Escape to cancel
    await userEvent.keyboard("{Escape}");
    // Should return to list
  });

  it("should work with screen readers", () => {
    render(
      <PaymentApprovalTool payments={mockPayments} onApprove={jest.fn()} onReject={jest.fn()} />,
    );

    // Check ARIA labels
    expect(screen.getByLabelText(/payment approval requests/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review payment/i })).toBeInTheDocument();
  });
});
```

## API Reference

### TeamPaymentApprovalTool Props

```typescript
interface TeamPaymentApprovalToolProps {
  payments: PaymentRequest[];
  onApprove?: (paymentId: string, notes?: string) => Promise<void>;
  onReject?: (paymentId: string, notes?: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}
```

### PaymentRequest Type

```typescript
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
```

### ApprovalDecision Type

```typescript
interface ApprovalDecision {
  approverId: string;
  paymentId: string;
  decision: "approve" | "reject";
  notes?: string;
  decidedAt: Date;
}
```

## Keyboard Shortcuts

- **Tab**: Move to next element
- **Shift+Tab**: Move to previous element
- **Arrow Up/Down**: Navigate payment rows
- **Enter/Space**: Select payment or activate button
- **Escape**: Cancel form, return to list
- **Ctrl+Enter / Cmd+Enter**: Submit form (quick approve/reject)

See [ACCESSIBILITY.md](ACCESSIBILITY.md) for complete keyboard navigation guide.

## Troubleshooting

### Component not rendering

Make sure you've imported from the correct path:

```tsx
// ✅ Correct
import { TeamPaymentApprovalTool } from "@/tools/v2/team/team-payment-approval";

// ❌ Wrong
import { TeamPaymentApprovalTool } from "@/features/team-payment-approval";
```

### Styles not applied

The tool uses Tailwind CSS classes. Ensure Tailwind is properly configured in your project.

### Types not recognized

Make sure TypeScript is updated and path aliases are configured correctly in `tsconfig.json`.

## Next Steps

- Read [ACCESSIBILITY.md](ACCESSIBILITY.md) for detailed accessibility testing
- Read [VISUAL_STYLE.md](VISUAL_STYLE.md) for component styling reference
- Check [demo.tsx](../demo.tsx) for more examples
- See [fixtures/payments.fixtures.ts](../fixtures/payments.fixtures.ts) for test data

## Questions?

Check the tool's folder structure and documentation:

```
tools/v2/team/team-payment-approval/
├── README.md           # Overview
├── docs/
│   ├── ACCESSIBILITY.md
│   ├── VISUAL_STYLE.md
│   └── GETTING_STARTED.md (this file)
├── components/         # UI components
├── hooks/             # Custom hooks
├── services/          # Business logic
└── fixtures/          # Test data
```
