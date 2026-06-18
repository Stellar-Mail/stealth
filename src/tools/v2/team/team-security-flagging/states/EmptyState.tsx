/**
 * Team Security Flagging Tool - Empty State Component
 * 
 * Displays when no flags are found
 */

import { Shield, AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  variant?: 'no-flags' | 'no-results' | 'no-access';
  onCreateFlag?: () => void;
  onClearFilters?: () => void;
  className?: string;
}

export function EmptyState({
  variant = 'no-flags',
  onCreateFlag,
  onClearFilters,
  className,
}: EmptyStateProps) {
  const variants = {
    'no-flags': {
      icon: <Shield className="size-6" aria-hidden="true" />,
      eyebrow: 'No flags yet',
      title: 'No security flags found',
      description:
        'There are currently no security flags in your team. When team members flag potential security concerns, they will appear here.',
      action: onCreateFlag ? (
        <Button onClick={onCreateFlag} aria-label="Create your first flag">
          Create First Flag
        </Button>
      ) : null,
    },
    'no-results': {
      icon: <Search className="size-6" aria-hidden="true" />,
      eyebrow: 'No results',
      title: 'No flags match your filters',
      description:
        'Try adjusting your search criteria or filters to find what you\'re looking for. You can clear all filters to see all flags.',
      action: onClearFilters ? (
        <Button variant="outline" onClick={onClearFilters} aria-label="Clear all filters">
          Clear Filters
        </Button>
      ) : null,
    },
    'no-access': {
      icon: <AlertTriangle className="size-6" aria-hidden="true" />,
      eyebrow: 'Access restricted',
      title: 'You don\'t have access',
      description:
        'You don\'t have permission to view security flags. Contact your team administrator to request access.',
      action: null,
    },
  };

  const state = variants[variant];

  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center text-center py-12',
        className
      )}
      role="status"
      aria-label={state.title}
    >
      {/* Icon */}
      <div
        className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground border border-border"
        aria-hidden="true"
      >
        {state.icon}
      </div>

      {/* Eyebrow */}
      {state.eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {state.eyebrow}
        </p>
      )}

      {/* Title */}
      <h2 className="mt-2 text-2xl font-semibold text-foreground">
        {state.title}
      </h2>

      {/* Description */}
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {state.description}
      </p>

      {/* Action */}
      {state.action && (
        <div className="mt-7">
          {state.action}
        </div>
      )}
    </div>
  );
}
