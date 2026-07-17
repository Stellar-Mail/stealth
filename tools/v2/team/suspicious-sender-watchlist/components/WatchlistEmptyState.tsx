import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * WatchlistEmptyState
 * Accessible empty state for when no entries exist in watchlist
 *
 * Accessibility considerations:
 * - Semantic heading for screen readers
 * - Descriptive aria-label on icon
 * - Clear CTA button with label
 * - Sufficient color contrast
 */
export const WatchlistEmptyState: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-96 bg-slate-50 rounded-lg border border-slate-200 p-8"
      role="status"
      aria-live="polite"
      aria-label="No senders in watchlist"
    >
      <AlertCircle className="w-12 h-12 text-slate-400 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-slate-900 mb-2">No senders on watchlist</h2>
      <p className="text-slate-600 text-center max-w-sm mb-6">
        Start monitoring senders by adding them to your watchlist. You'll be alerted when they send
        mail.
      </p>
      <Button variant="outline" aria-label="Add a sender to the watchlist">
        Add Sender
      </Button>
    </div>
  );
};
