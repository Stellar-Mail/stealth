/**
 * Team Security Flagging Tool - Flag List Component
 * 
 * Displays a list of security flags with filtering and sorting
 */

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SecurityFlag, FlagSeverity } from '../types';
import { SEVERITY_META, STATUS_META, CATEGORY_META } from '../constants';
import { formatDateForSR } from '../utils/accessibility';

interface FlagListProps {
  flags: SecurityFlag[];
  selectedId?: string | null;
  onSelect: (flag: SecurityFlag) => void;
  className?: string;
}

export function FlagList({ flags, selectedId, onSelect, className }: FlagListProps) {
  return (
    <div
      className={cn('space-y-2', className)}
      role="list"
      aria-label="Security flags list"
    >
      {flags.map((flag) => (
        <FlagListItem
          key={flag.id}
          flag={flag}
          isSelected={selectedId === flag.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface FlagListItemProps {
  flag: SecurityFlag;
  isSelected: boolean;
  onSelect: (flag: SecurityFlag) => void;
}

function FlagListItem({ flag, isSelected, onSelect }: FlagListItemProps) {
  const severityMeta = SEVERITY_META[flag.severity];
  const statusMeta = STATUS_META[flag.status];
  const categoryMeta = CATEGORY_META[flag.category];

  // Format time for screen readers
  const timeAgoSR = formatDateForSR(flag.createdAt);
  const timeAgo = formatDistanceToNow(flag.createdAt, { addSuffix: true });

  return (
    <div
      role="listitem"
      tabIndex={0}
      onClick={() => onSelect(flag)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(flag);
        }
      }}
      className={cn(
        'group rounded-lg border bg-card p-4 transition-all cursor-pointer',
        'hover:border-primary/50 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-primary bg-accent/30'
      )}
      aria-label={`Flag: ${flag.title}. ${categoryMeta.label}. ${severityMeta.label} severity. ${statusMeta.label}. Reported ${timeAgoSR}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {flag.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span aria-label={`Category: ${categoryMeta.label}`}>
              {categoryMeta.label}
            </span>
            <span aria-hidden="true">•</span>
            <span aria-label={`Reported ${timeAgoSR}`}>
              {timeAgo}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border shrink-0',
            statusMeta.color
          )}
          aria-label={`Status: ${statusMeta.label}`}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {flag.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Severity badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
              severityMeta.color
            )}
            aria-label={`Severity: ${severityMeta.label}`}
          >
            <SeverityIcon severity={flag.severity} className="size-3" aria-hidden="true" />
            {severityMeta.label}
          </span>

          {/* Tags */}
          {flag.tags && flag.tags.length > 0 && (
            <span className="text-xs text-muted-foreground" aria-label={`Tags: ${flag.tags.join(', ')}`}>
              {flag.tags.length} tag{flag.tags.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Reporter */}
        <span className="text-xs text-muted-foreground" aria-label={`Reported by ${flag.reportedBy.name}`}>
          {flag.reportedBy.name}
        </span>
      </div>
    </div>
  );
}

/**
 * Severity icon component
 */
function SeverityIcon({ severity, className }: { severity: FlagSeverity; className?: string }) {
  const iconProps = { className, 'aria-hidden': true };

  switch (severity) {
    case 'low':
      return <Info {...iconProps} />;
    case 'medium':
      return <AlertTriangle {...iconProps} />;
    case 'high':
      return <AlertCircle {...iconProps} />;
    case 'critical':
      return <AlertOctagon {...iconProps} />;
  }
}

/**
 * Compact flag list for sidebars
 */
export function CompactFlagList({ flags, selectedId, onSelect, className }: FlagListProps) {
  return (
    <div
      className={cn('space-y-1', className)}
      role="list"
      aria-label="Security flags list"
    >
      {flags.map((flag) => {
        const isSelected = selectedId === flag.id;
        const severityMeta = SEVERITY_META[flag.severity];

        return (
          <button
            key={flag.id}
            role="listitem"
            onClick={() => onSelect(flag)}
            className={cn(
              'w-full text-left rounded-md px-3 py-2 transition-colors',
              'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'bg-accent'
            )}
            aria-label={`${flag.title}. ${severityMeta.label} severity`}
          >
            <div className="flex items-center gap-2">
              <SeverityIcon severity={flag.severity} className="size-3 shrink-0" />
              <span className="text-sm font-medium truncate flex-1">
                {flag.title}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
