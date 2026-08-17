/**
 * Team Payment Approval Tool - Demo & Testing Setup
 *
 * This file demonstrates how to use the Team Payment Approval tool
 * in a demo or testing environment.
 *
 * For production integration, see README.md and docs/
 */

import React, { useState } from "react";
import { TeamPaymentApprovalTool } from "./components/team-payment-approval-tool";
import { mockPayments, getMockPendingPayments } from "./fixtures/payments.fixtures";
import { usePaymentApproval } from "./hooks/use-payment-approval";

/**
 * Demo component showing the tool in action
 */
export function TeamPaymentApprovalDemo() {
  const [payments, setPayments] = useState(getMockPendingPayments());
  const { approve, reject, error } = usePaymentApproval({
    onApprove: async (paymentId) => {
      // Simulate API call
      await new Promise((r) => setTimeout(r, 1000));
      console.log("Approved:", paymentId);

      // Update local state
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: "approved" as const } : p)),
      );
    },
    onReject: async (paymentId) => {
      // Simulate API call
      await new Promise((r) => setTimeout(r, 1000));
      console.log("Rejected:", paymentId);

      // Update local state
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: "rejected" as const } : p)),
      );
    },
  });

  const pendingPayments = payments.filter((p) => p.status === "pending");

  return (
    <div className="w-full min-h-screen bg-background">
      <TeamPaymentApprovalTool
        payments={pendingPayments}
        onApprove={async (paymentId, notes) => {
          await approve(paymentId, notes);
        }}
        onReject={async (paymentId, notes) => {
          await reject(paymentId, notes);
        }}
        isLoading={false}
        error={error}
      />
    </div>
  );
}

/**
 * Minimal usage example
 */
export function MinimalExample() {
  return (
    <TeamPaymentApprovalTool
      payments={mockPayments}
      onApprove={async (paymentId, notes) => {
        console.log("Approved payment:", paymentId);
        console.log("Notes:", notes);
      }}
      onReject={async (paymentId, notes) => {
        console.log("Rejected payment:", paymentId);
        console.log("Notes:", notes);
      }}
    />
  );
}

/**
 * With error handling example
 */
export function WithErrorHandling() {
  const [error, setError] = useState<string | null>(null);

  return (
    <TeamPaymentApprovalTool
      payments={mockPayments}
      onApprove={async (paymentId) => {
        try {
          // Simulate API call that might fail
          if (Math.random() > 0.7) {
            throw new Error("Insufficient permissions to approve this payment");
          }
          console.log("Approved:", paymentId);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unknown error");
          throw err;
        }
      }}
      onReject={async (paymentId) => {
        console.log("Rejected:", paymentId);
      }}
      error={error}
    />
  );
}

export default TeamPaymentApprovalDemo;
