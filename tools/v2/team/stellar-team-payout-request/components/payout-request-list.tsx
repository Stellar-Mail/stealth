import type { PayoutRequest, PayoutStatus, PayoutPriority } from "../types";

interface PayoutRequestListProps {
  payouts: PayoutRequest[];
  onSelectPayout?: (payout: PayoutRequest) => void;
  selectedPayoutId?: string;
}

const STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<PayoutStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  submitted: "bg-blue-500/10 text-blue-600",
  confirmed: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const PRIORITY_CLASSES: Record<PayoutPriority, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-600",
  urgent: "text-destructive font-semibold",
};

/**
 * PayoutRequestList
 *
 * Accessible list of payout requests.
 *
 * Accessibility features:
 * - Semantic <ul>/<li> structure
 * - Each row is keyboard-activatable (button)
 * - Status badges use aria-label to describe state
 * - Selected row indicated with aria-pressed
 */
export function PayoutRequestList({
  payouts,
  onSelectPayout,
  selectedPayoutId,
}: PayoutRequestListProps) {
  return (
    <section aria-label="Payout requests">
      <ul className="space-y-3" role="list">
        {payouts.map((payout) => {
          const isSelected = payout.id === selectedPayoutId;
          return (
            <li key={payout.id}>
              <button
                type="button"
                onClick={() => onSelectPayout?.(payout)}
                aria-pressed={isSelected}
                aria-label={`Payout to ${payout.recipient.name}, ${payout.amount} ${payout.currency}, status: ${STATUS_LABELS[payout.status]}`}
                className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{payout.recipient.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {payout.recipient.stellarAddress.slice(0, 12)}…
                      {payout.recipient.stellarAddress.slice(-6)}
                    </p>
                    {payout.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {payout.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-lg font-semibold text-foreground">
                      {payout.amount.toLocaleString()} {payout.currency}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[payout.status]}`}
                      aria-label={`Status: ${STATUS_LABELS[payout.status]}`}
                    >
                      {STATUS_LABELS[payout.status]}
                    </span>
                    <span
                      className={`text-xs ${PRIORITY_CLASSES[payout.priority]}`}
                      aria-label={`Priority: ${payout.priority}`}
                    >
                      {payout.priority.charAt(0).toUpperCase() + payout.priority.slice(1)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Requested by {payout.requestedBy} ·{" "}
                  {new Date(payout.requestedAt).toLocaleDateString()}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { PayoutRequestListProps };
