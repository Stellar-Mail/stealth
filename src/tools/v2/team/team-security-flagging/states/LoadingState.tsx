/**
 * Team Security Flagging Tool - Loading State Component
 * 
 * Skeleton loader for flag list and details
 */

import { cn } from '@/lib/utils';

interface LoadingStateProps {
  variant?: 'list' | 'detail' | 'minimal';
  count?: number;
  className?: string;
}

export function LoadingState({ variant = 'list', count = 5, className }: LoadingStateProps) {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center justify-center py-12', className)} role="status">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Loading flags...</span>
        </div>
        <span className="sr-only">Loading security flags, please wait</span>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-6 p-6', className)} role="status">
        <span className="sr-only">Loading flag details, please wait</span>
        
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              {/* Title */}
              <div className="h-7 w-3/4 animate-pulse rounded bg-muted" aria-hidden="true" />
              {/* Metadata */}
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden="true" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden="true" />
              </div>
            </div>
            {/* Status badge */}
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" aria-hidden="true" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" aria-hidden="true" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" aria-hidden="true" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" aria-hidden="true" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" aria-hidden="true" />
        </div>

        {/* Reporter info */}
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-muted" aria-hidden="true" />
            <div className="space-y-1 flex-1">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" aria-hidden="true" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" aria-hidden="true" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // List variant (default)
  return (
    <div className={cn('space-y-3', className)} role="status">
      <span className="sr-only">Loading list of security flags, please wait</span>
      
      {Array.from({ length: count }, (_, i) => (
        <FlagListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Individual flag list item skeleton
 */
function FlagListItemSkeleton() {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          {/* Metadata */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
        {/* Status badge */}
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/**
 * Simple spinner component
 */
export function Spinner({ className, size = 'default' }: { className?: string; size?: 'sm' | 'default' | 'lg' }) {
  const sizeClasses = {
    sm: 'size-4 border-2',
    default: 'size-6 border-3',
    lg: 'size-8 border-4',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-muted border-t-primary',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
