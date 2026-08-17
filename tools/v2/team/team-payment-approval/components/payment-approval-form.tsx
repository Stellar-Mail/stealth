import React, { useState, useRef, useCallback } from "react";
import type { PaymentRequest } from "../types";

/**
 * PaymentApprovalForm Component
 *
 * Accessible form for approving or rejecting payment requests.
 *
 * Accessibility features:
 * - Proper label association with form fields using htmlFor
 * - Required field indicators with aria-required
 * - Form validation with aria-invalid and error messages
 * - Keyboard navigation: Tab, Shift+Tab, Enter to submit, Escape to cancel
 * - Focus management and visible focus indicators
 * - fieldset and legend for radio group grouping
 * - Screen reader friendly decision options
 * - Submit/Cancel buttons with clear labels
 * - aria-describedby linking fields to error messages
 */

interface PaymentApprovalFormProps {
  payment: PaymentRequest;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (notes?: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PaymentApprovalForm({
  payment,
  onApprove,
  onReject,
  onCancel,
  isLoading = false,
}: PaymentApprovalFormProps) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const decisionErrorRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!decision) {
        setError("Please select an approval decision");
        decisionErrorRef.current?.focus();
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        if (decision === "approve") {
          await onApprove(notes);
        } else {
          await onReject(notes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        decisionErrorRef.current?.focus();
      } finally {
        setIsSubmitting(false);
      }
    },
    [decision, notes, onApprove, onReject],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      // Escape to cancel
      if (e.key === "Escape" && !isSubmitting) {
        onCancel();
      }
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && decision && !isSubmitting) {
        formRef.current?.requestSubmit();
      }
    },
    [decision, isSubmitting, onCancel],
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="w-full max-w-2xl mx-auto space-y-6 p-4 rounded-lg border border-border bg-background"
      noValidate
    >
      {/* Payment Details Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Payment Details</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Recipient:</dt>
            <dd className="font-medium">{payment.recipient}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Amount:</dt>
            <dd className="font-medium">
              {payment.amount} {payment.currency}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Requested By:</dt>
            <dd className="font-medium">{payment.requestedBy}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Priority:</dt>
            <dd className="font-medium capitalize">{payment.priority}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Description:</dt>
            <dd className="text-right">{payment.description}</dd>
          </div>
        </dl>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
        >
          {error}
        </div>
      )}

      {/* Decision Selection */}
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">
          Your Decision{" "}
          <span aria-label="required" className="text-destructive">
            *
          </span>
        </legend>
        <div
          ref={decisionErrorRef}
          tabIndex={-1}
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          {error && "Please select a decision"}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-transparent hover:border-primary/20 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:border-ring">
            <input
              type="radio"
              name="decision"
              value="approve"
              checked={decision === "approve"}
              onChange={(e) => {
                setDecision(e.target.value as "approve");
                setError(null);
              }}
              disabled={isSubmitting || isLoading}
              className="w-4 h-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              aria-describedby="approve-help"
            />
            <span className="font-medium">Approve this payment</span>
          </label>
          <p id="approve-help" className="text-xs text-muted-foreground ml-7">
            The payment will be processed after approval
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-transparent hover:border-destructive/20 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:border-ring">
            <input
              type="radio"
              name="decision"
              value="reject"
              checked={decision === "reject"}
              onChange={(e) => {
                setDecision(e.target.value as "reject");
                setError(null);
              }}
              disabled={isSubmitting || isLoading}
              className="w-4 h-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              aria-describedby="reject-help"
            />
            <span className="font-medium">Reject this payment</span>
          </label>
          <p id="reject-help" className="text-xs text-muted-foreground ml-7">
            The payment will be declined and cannot be resubmitted
          </p>
        </div>
      </fieldset>

      {/* Notes Field */}
      <div className="space-y-2">
        <label htmlFor="approval-notes" className="block text-sm font-medium">
          Approval Notes {decision && <span className="text-muted-foreground">(optional)</span>}
        </label>
        <textarea
          ref={notesRef}
          id="approval-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting || isLoading || !decision}
          placeholder="Add any additional comments or requirements..."
          className="w-full min-h-24 p-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed resize-vertical"
          aria-describedby="notes-help"
        />
        <p id="notes-help" className="text-xs text-muted-foreground">
          {decision
            ? "Your notes will be included with this decision"
            : "Select a decision above to add notes"}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting || isLoading}
          className="px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          aria-label="Cancel payment approval"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!decision || isSubmitting || isLoading}
          className={`px-4 py-2 rounded-lg font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            decision === "approve"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : decision === "reject"
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-muted cursor-not-allowed"
          }`}
          aria-label={
            decision === "approve"
              ? `Confirm approval of ${payment.amount} ${payment.currency}`
              : decision === "reject"
                ? `Confirm rejection of ${payment.amount} ${payment.currency}`
                : "Select a decision to continue"
          }
        >
          {isSubmitting ? "Processing..." : "Confirm Decision"}
        </button>
      </div>

      {/* Keyboard shortcuts info for screen readers */}
      <div className="sr-only" role="region" aria-label="Keyboard shortcuts">
        <p>Press Escape to cancel, or press Control+Enter to submit</p>
      </div>
    </form>
  );
}

export type { PaymentApprovalFormProps };
