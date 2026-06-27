/**
 * PayoutStatus
 *
 * Displays the current state of a submitted payout request.
 */
import type { PayoutRequest, PayoutStatus } from "../types";

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<PayoutStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

interface PayoutStatusProps {
  payout: PayoutRequest;
  onRetry?: () => Promise<void>;
  onCancel?: (id: string) => void;
  className?: string;
}

export function PayoutStatusDisplay({ payout, onRetry, onCancel, className }: PayoutStatusProps) {
  const statusLabel = STATUS_LABEL[payout.status];
  const statusColor = STATUS_COLOR[payout.status];

  return (
    <article
      aria-label={`Payout request to ${payout.recipientEmail}`}
      className={`rounded-lg border border-border bg-card p-5 space-y-3 ${className ?? ""}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground truncate">{payout.recipientEmail}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
          aria-label={`Status: ${statusLabel}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Amount */}
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {payout.amount} <span className="text-sm font-normal text-muted-foreground">XLM</span>
      </p>

      {/* Memo */}
      {payout.memo ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Memo:</span> {payout.memo}
        </p>
      ) : null}

      {/* Transaction ID */}
      {payout.transactionId ? (
        <p className="text-xs text-muted-foreground break-all">
          <span className="font-medium">Tx ID:</span> {payout.transactionId}
        </p>
      ) : null}

      {/* Error */}
      {payout.error ? (
        <p role="alert" className="text-xs text-destructive">
          <span className="font-medium">Error:</span> {payout.error}
        </p>
      ) : null}

      {/* Timestamps */}
      <dl className="flex gap-4 text-xs text-muted-foreground">
        <div>
          <dt className="sr-only">Created</dt>
          <dd>Created {new Date(payout.createdAt).toLocaleString()}</dd>
        </div>
        {payout.confirmedAt ? (
          <div>
            <dt className="sr-only">Confirmed</dt>
            <dd>Confirmed {new Date(payout.confirmedAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      {/* Actions */}
      {(payout.status === "failed" && onRetry) || (payout.status === "pending" && onCancel) ? (
        <div className="flex gap-2 pt-1">
          {payout.status === "failed" && onRetry ? (
            <button
              onClick={onRetry}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Retry
            </button>
          ) : null}
          {payout.status === "pending" && onCancel ? (
            <button
              onClick={() => onCancel(payout.id)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export type { PayoutStatusProps };
