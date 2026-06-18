import React, { useRef, useCallback } from "react";
import type { PaymentRequest } from "../types";

/**
 * PaymentApprovalList Component
 *
 * Accessible list of payment requests to review.
 *
 * Accessibility features:
 * - Semantic table structure with proper headers
 * - Sortable columns with aria-sort indicating current sort state
 * - Keyboard navigation with arrow keys and Enter
 * - Row selection with focus management
 * - aria-label on action buttons
 * - Status badges with aria-label for color-coded information
 * - Responsive with proper contrast
 * - Focus indicators on interactive elements
 */

interface PaymentApprovalListProps {
  payments: PaymentRequest[];
  onSelectPayment: (payment: PaymentRequest) => void;
  selectedPaymentId?: string;
  isLoading?: boolean;
  sortBy?: "date" | "amount" | "priority";
  onSort?: (sortBy: "date" | "amount" | "priority") => void;
}

const STATUS_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-800 dark:text-yellow-100" },
  approved: {
    bg: "bg-emerald-100 dark:bg-emerald-900",
    text: "text-emerald-800 dark:text-emerald-100",
  },
  rejected: { bg: "bg-destructive/10", text: "text-destructive" },
  expired: { bg: "bg-gray-100 dark:bg-gray-900", text: "text-gray-800 dark:text-gray-100" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-destructive",
};

export function PaymentApprovalList({
  payments,
  onSelectPayment,
  selectedPaymentId,
  isLoading,
  sortBy,
  onSort,
}: PaymentApprovalListProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, payment: PaymentRequest) => {
      const rows = tableRef.current?.querySelectorAll("tbody tr");
      if (!rows) return;

      const currentIndex = Array.from(rows).findIndex(
        (row) => row.dataset.paymentId === payment.id,
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < rows.length - 1) {
            const nextRow = rows[currentIndex + 1] as HTMLTableRowElement;
            nextRow.focus();
            const nextId = nextRow.dataset.paymentId;
            if (nextId) {
              const nextPayment = payments.find((p) => p.id === nextId);
              if (nextPayment) onSelectPayment(nextPayment);
            }
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            const prevRow = rows[currentIndex - 1] as HTMLTableRowElement;
            prevRow.focus();
            const prevId = prevRow.dataset.paymentId;
            if (prevId) {
              const prevPayment = payments.find((p) => p.id === prevId);
              if (prevPayment) onSelectPayment(prevPayment);
            }
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onSelectPayment(payment);
          break;
      }
    },
    [payments, onSelectPayment],
  );

  const handleSortClick = (newSort: "date" | "amount" | "priority") => {
    onSort?.(newSort);
  };

  const getSortAriaSort = (column: string) => {
    if (sortBy !== column) return "none";
    return "ascending";
  };

  return (
    <div className="w-full overflow-auto">
      <table
        ref={tableRef}
        className="w-full text-sm"
        role="grid"
        aria-label="Payment approval requests"
        aria-busy={isLoading}
      >
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold">Recipient</th>
            <th className="px-4 py-3 text-left font-semibold">
              <button
                onClick={() => handleSortClick("amount")}
                className="flex items-center gap-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                aria-sort={getSortAriaSort("amount")}
              >
                Amount
                <span aria-hidden="true" className="text-xs">
                  {sortBy === "amount" ? "↓" : "↕"}
                </span>
              </button>
            </th>
            <th className="px-4 py-3 text-left font-semibold">
              <button
                onClick={() => handleSortClick("priority")}
                className="flex items-center gap-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                aria-sort={getSortAriaSort("priority")}
              >
                Priority
                <span aria-hidden="true" className="text-xs">
                  {sortBy === "priority" ? "↓" : "↕"}
                </span>
              </button>
            </th>
            <th className="px-4 py-3 text-left font-semibold">Requested By</th>
            <th className="px-4 py-3 text-left font-semibold">
              <button
                onClick={() => handleSortClick("date")}
                className="flex items-center gap-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                aria-sort={getSortAriaSort("date")}
              >
                Date
                <span aria-hidden="true" className="text-xs">
                  {sortBy === "date" ? "↓" : "↕"}
                </span>
              </button>
            </th>
            <th className="px-4 py-3 text-left font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const isSelected = selectedPaymentId === payment.id;
            const statusColors = STATUS_BADGE_COLORS[payment.status];
            const priorityColor = PRIORITY_COLORS[payment.priority];

            return (
              <tr
                key={payment.id}
                ref={isSelected ? selectedRowRef : undefined}
                data-payment-id={payment.id}
                onKeyDown={(e) => handleKeyDown(e, payment)}
                onClick={() => onSelectPayment(payment)}
                tabIndex={0}
                role="row"
                className={`border-b border-border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  isSelected
                    ? "bg-primary/10 hover:bg-primary/15"
                    : "hover:bg-muted/50 active:bg-muted"
                }`}
                aria-selected={isSelected}
              >
                <td className="px-4 py-3 font-medium">{payment.recipient}</td>
                <td className="px-4 py-3">
                  {payment.amount} {payment.currency}
                </td>
                <td className={`px-4 py-3 font-semibold capitalize ${priorityColor}`}>
                  {payment.priority}
                </td>
                <td className="px-4 py-3">{payment.requestedBy}</td>
                <td className="px-4 py-3">
                  <time dateTime={new Date(payment.requestedAt).toISOString()}>
                    {new Date(payment.requestedAt).toLocaleDateString()}
                  </time>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                    role="status"
                    aria-label={`Status: ${payment.status}`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPayment(payment);
                    }}
                    className="px-3 py-1 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Review payment of ${payment.amount} ${payment.currency} to ${payment.recipient}`}
                    disabled={payment.status !== "pending"}
                  >
                    Review
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { PaymentApprovalListProps };
