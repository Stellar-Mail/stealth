import React from "react";
import { Skeleton } from "../../../src/components/ui/skeleton";

/**
 * WatchlistLoadingState
 * Accessible loading state with skeleton placeholders
 *
 * Accessibility considerations:
 * - aria-busy indicates loading state to screen readers
 * - Skeleton components announce as busy but not blocking
 * - Proper label for loading context
 */
export const WatchlistLoadingState: React.FC = () => {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading watchlist">
      <div className="text-sm text-slate-600">Loading watchlist...</div>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
};
