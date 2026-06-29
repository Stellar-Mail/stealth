// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
  PaymentApprovalList,
  PaymentApprovalForm,
  TeamPaymentApprovalTool,
} from "../components";
import { mockPayments } from "../fixtures/payments.fixtures";

afterEach(() => {
  cleanup();
});

describe("State components", () => {
  it("should render EmptyState with title, description, and action button", () => {
    const actionMock = vi.fn();
    render(
      <EmptyState
        title="No Payments Found"
        description="Try refreshing."
        action={<button onClick={actionMock}>Refresh</button>}
      />,
    );

    expect(screen.getByText("No Payments Found")).toBeDefined();
    expect(screen.getByText("Try refreshing.")).toBeDefined();

    const btn = screen.getByRole("button", { name: "Refresh" });
    fireEvent.click(btn);
    expect(actionMock).toHaveBeenCalled();
  });

  it("should render LoadingState with loading message", () => {
    render(<LoadingState message="Fetching data..." itemCount={2} />);
    expect(screen.getByText("Fetching data...")).toBeDefined();
  });

  it("should render ErrorState with details and action button", () => {
    const actionMock = vi.fn();
    render(
      <ErrorState
        title="Something went wrong"
        details="Timeout error"
        action={<button onClick={actionMock}>Retry</button>}
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText("Timeout error")).toBeDefined();

    const btn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(btn);
    expect(actionMock).toHaveBeenCalled();
  });

  it("should render SuccessState", () => {
    render(<SuccessState title="Success!" details="Payment approved." />);
    expect(screen.getByText("Success!")).toBeDefined();
    expect(screen.getByText("Payment approved.")).toBeDefined();
  });
});

describe("PaymentApprovalList component", () => {
  it("should render list of payment requests", () => {
    const onSelectMock = vi.fn();
    render(<PaymentApprovalList payments={mockPayments} onSelectPayment={onSelectMock} />);

    // Verify recipient names are displayed
    expect(screen.getByText("Acme Corp")).toBeDefined();
    expect(screen.getByText("Stellar Development")).toBeDefined();

    // Find review button
    const reviewBtns = screen.getAllByRole("button", { name: /Review payment of/ });
    expect(reviewBtns.length).toBeGreaterThan(0);
    fireEvent.click(reviewBtns[0]);
    expect(onSelectMock).toHaveBeenCalledWith(mockPayments[0]);
  });

  it("should sort when column buttons are clicked", () => {
    const onSortMock = vi.fn();
    render(
      <PaymentApprovalList
        payments={mockPayments}
        onSelectPayment={() => {}}
        onSort={onSortMock}
        sortBy="date"
      />,
    );

    const amountHeader = screen.getByRole("button", { name: "Amount" });
    fireEvent.click(amountHeader);
    expect(onSortMock).toHaveBeenCalledWith("amount");
  });

  it("should support keyboard navigation", () => {
    const onSelectMock = vi.fn();
    render(<PaymentApprovalList payments={mockPayments} onSelectPayment={onSelectMock} />);

    const rows = screen.getAllByRole("row");
    // Row 0 is the table header, Row 1 is the first payment item
    const firstRow = rows[1];
    firstRow.focus();

    // Press ArrowDown
    fireEvent.keyDown(firstRow, { key: "ArrowDown" });
    // Should trigger onSelectPayment for the second item
    expect(onSelectMock).toHaveBeenCalledWith(mockPayments[1]);
  });
});

describe("PaymentApprovalForm component", () => {
  it("should render details and selection controls", () => {
    render(
      <PaymentApprovalForm
        payment={mockPayments[0]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Acme Corp")).toBeDefined();
    expect(screen.getByText("5000 USD")).toBeDefined();
    expect(screen.getByLabelText("Approve this payment")).toBeDefined();
    expect(screen.getByLabelText("Reject this payment")).toBeDefined();
  });

  it("should show validation error if submitting without decision", async () => {
    render(
      <PaymentApprovalForm
        payment={mockPayments[0]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Select a decision to continue" });
    // It should be disabled initially
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });

  it("should invoke callbacks on approval and rejection", async () => {
    const onApproveMock = vi.fn().mockResolvedValue(undefined);
    const onRejectMock = vi.fn().mockResolvedValue(undefined);

    render(
      <PaymentApprovalForm
        payment={mockPayments[0]}
        onApprove={onApproveMock}
        onReject={onRejectMock}
        onCancel={vi.fn()}
      />,
    );

    // Select Approve radio button
    const approveRadio = screen.getByLabelText("Approve this payment");
    fireEvent.click(approveRadio);

    // Type notes
    const notesTextarea = screen.getByLabelText(/Approval Notes/);
    fireEvent.change(notesTextarea, { target: { value: "Approved notes" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Confirm approval of/ });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    // Simulate form submission
    fireEvent.click(submitBtn);

    expect(onApproveMock).toHaveBeenCalledWith("Approved notes");
  });
});

describe("TeamPaymentApprovalTool component integration", () => {
  it("should run full workflow successfully", async () => {
    const onApproveMock = vi.fn().mockResolvedValue(undefined);

    render(<TeamPaymentApprovalTool payments={mockPayments} onApprove={onApproveMock} />);

    // Should display list initially
    expect(screen.getByText("Pending Approvals (6)")).toBeDefined();

    // Click review on first item
    const reviewBtns = screen.getAllByRole("button", { name: /Review payment of/ });
    fireEvent.click(reviewBtns[0]);

    // Should display form now
    expect(screen.getByText("Payment Details")).toBeDefined();

    // Approve the payment
    const approveRadio = screen.getByLabelText("Approve this payment");
    fireEvent.click(approveRadio);

    const submitBtn = screen.getByRole("button", { name: /Confirm approval of/ });
    fireEvent.click(submitBtn);

    // Wait and verify we enter SuccessState
    expect(await screen.findByText("Payment Approved")).toBeDefined();
  });
});
