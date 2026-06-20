import React from "react";
import { Skeleton } from "../../../src/components/ui/skeleton";

/**
 * SharedDraftLoadingState
 * Accessible loading state with skeleton placeholders
 *
 * Accessibility considerations:
 * - aria-busy indicates loading state to screen readers
 * - Skeleton components announce as busy but not blocking
 * - Proper label for loading context
 */
export const SharedDraftLoadingState: React.FC = () => {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading shared drafts">
      <div className="text-sm text-slate-600">Loading drafts...</div>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 p-4 bg-white rounded-lg border border-slate-200"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-60" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-12 rounded" />
            <Skeleton className="h-6 w-12 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
