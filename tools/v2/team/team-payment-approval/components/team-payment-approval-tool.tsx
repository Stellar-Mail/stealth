import React, { useState, useCallback, useEffect } from "react";
import type { PaymentRequest, ApprovalDecision } from "../types";
import {
  PaymentApprovalList,
  PaymentApprovalForm,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
} from "./index";

/**
 * TeamPaymentApprovalTool
 *
 * Main container component for the Team Payment Approval tool.
 * This is a self-contained, locally-scoped workflow for reviewing and approving payments.
 *
 * States:
 * - idle: Showing payment list
 * - reviewing: Showing payment form
 * - loading: Loading data
 * - error: Error state
 * - success: Success confirmation
 *
 * Accessibility:
 * - Focus management between list and form
 * - Keyboard shortcuts documented
 * - Screen reader friendly state announcements
 * - Proper heading hierarchy
 */

type ViewState = "list" | "reviewing" | "loading" | "error" | "success";

interface TeamPaymentApprovalToolProps {
  payments: PaymentRequest[];
  onApprove?: (paymentId: string, notes?: string) => Promise<void>;
  onReject?: (paymentId: string, notes?: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function TeamPaymentApprovalTool({
  payments,
  onApprove,
  onReject,
  isLoading = false,
  error: initialError = null,
}: TeamPaymentApprovalToolProps) {
  const [viewState, setViewState] = useState<ViewState>(isLoading ? "loading" : "list");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "priority">("date");
  const [approvedPayments, setApprovedPayments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading) {
      setViewState("loading");
    } else if (initialError) {
      setError(initialError);
      setViewState("error");
    } else if (payments.length === 0) {
      setViewState("list");
    }
  }, [isLoading, initialError, payments.length]);

  const handleSelectPayment = useCallback((payment: PaymentRequest) => {
    setSelectedPayment(payment);
    setViewState("reviewing");
    // Announce to screen readers
    const announcement = `Reviewing payment of ${payment.amount} ${payment.currency} to ${payment.recipient}`;
    const ariaLive = document.createElement("div");
    ariaLive.setAttribute("role", "status");
    ariaLive.setAttribute("aria-live", "polite");
    ariaLive.className = "sr-only";
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => ariaLive.remove(), 1000);
  }, []);

  const handleApprove = useCallback(
    async (notes?: string) => {
      if (!selectedPayment || !onApprove) return;

      try {
        setViewState("loading");
        await onApprove(selectedPayment.id, notes);
        setApprovedPayments((prev) => new Set(prev).add(selectedPayment.id));
        setViewState("success");

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          setViewState("list");
          setSelectedPayment(null);
        }, 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed");
        setViewState("error");
      }
    },
    [selectedPayment, onApprove],
  );

  const handleReject = useCallback(
    async (notes?: string) => {
      if (!selectedPayment || !onReject) return;

      try {
        setViewState("loading");
        await onReject(selectedPayment.id, notes);
        setViewState("success");

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          setViewState("list");
          setSelectedPayment(null);
        }, 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Rejection failed");
        setViewState("error");
      }
    },
    [selectedPayment, onReject],
  );

  const handleCancel = useCallback(() => {
    setViewState("list");
    setSelectedPayment(null);
    setError(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (error) {
      setError(null);
      setViewState("list");
    }
  }, [error]);

  const sortedPayments = [...payments].sort((a, b) => {
    switch (sortBy) {
      case "amount":
        return b.amount - a.amount;
      case "priority": {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (
          priorityOrder[a.priority as keyof typeof priorityOrder] -
          priorityOrder[b.priority as keyof typeof priorityOrder]
        );
      }
      case "date":
      default:
        return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    }
  });

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-muted/30 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Payment Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve pending payment requests for your team
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {viewState === "loading" && <LoadingState />}

        {viewState === "error" && error && (
          <ErrorState
            title="Unable to load payments"
            details={error}
            action={
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try Again
              </button>
            }
          />
        )}

        {viewState === "list" && sortedPayments.length === 0 && (
          <EmptyState
            icon="📭"
            title="No Pending Payments"
            description="There are no payment requests awaiting your approval at this time."
            action={
              <button
                onClick={() => setViewState("list")}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Refresh
              </button>
            }
          />
        )}

        {viewState === "list" && sortedPayments.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pending Approvals ({sortedPayments.length})</h2>
              <span className="text-sm text-muted-foreground">
                {approvedPayments.size} approved this session
              </span>
            </div>
            <PaymentApprovalList
              payments={sortedPayments}
              onSelectPayment={handleSelectPayment}
              selectedPaymentId={selectedPayment?.id}
              sortBy={sortBy}
              onSort={setSortBy}
            />
          </div>
        )}

        {viewState === "reviewing" && selectedPayment && (
          <div className="space-y-4">
            <button
              onClick={handleCancel}
              className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
              aria-label="Back to payment list"
            >
              ← Back to List
            </button>
            <PaymentApprovalForm
              payment={selectedPayment}
              onApprove={handleApprove}
              onReject={handleReject}
              onCancel={handleCancel}
              isLoading={false}
            />
          </div>
        )}

        {viewState === "success" && selectedPayment && (
          <SuccessState
            icon="✅"
            title={
              approvedPayments.has(selectedPayment.id) ? "Payment Approved" : "Payment Rejected"
            }
            details={
              approvedPayments.has(selectedPayment.id)
                ? `Successfully approved ${selectedPayment.amount} ${selectedPayment.currency} to ${selectedPayment.recipient}. Redirecting to payment list...`
                : `Successfully rejected the payment request. Redirecting to payment list...`
            }
          />
        )}
      </main>

      {/* Accessibility Announcements Region */}
      <div role="region" aria-live="polite" aria-label="Status messages" className="sr-only" />
    </div>
  );
}

export type { TeamPaymentApprovalToolProps };
