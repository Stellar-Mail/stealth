/**
 * Team Security Flagging Tool - Flag Detail Component
 * 
 * Detailed view of a single security flag
 */

import { format } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  User,
  Calendar,
  Tag,
  MessageSquare,
  Paperclip,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { SecurityFlag } from '../types';
import { SEVERITY_META, STATUS_META, CATEGORY_META, DATE_TIME_FORMAT } from '../constants';

interface FlagDetailProps {
  flag: SecurityFlag;
  onEdit?: (flag: SecurityFlag) => void;
  onDelete?: (flag: SecurityFlag) => void;
  onResolve?: (flag: SecurityFlag) => void;
  onDismiss?: (flag: SecurityFlag) => void;
  className?: string;
}

export function FlagDetail({
  flag,
  onEdit,
  onDelete,
  onResolve,
  onDismiss,
  className,
}: FlagDetailProps) {
  const severityMeta = SEVERITY_META[flag.severity];
  const statusMeta = STATUS_META[flag.status];
  const categoryMeta = CATEGORY_META[flag.category];

  const canResolve = flag.status === 'pending' || flag.status === 'reviewing';
  const canDismiss = flag.status === 'pending' || flag.status === 'reviewing';

  return (
    <div className={cn('space-y-6', className)} role="article" aria-label="Flag details">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-foreground break-words">
              {flag.title}
            </h1>
            
            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1" aria-label={`Category: ${categoryMeta.label}`}>
                <Tag className="size-4" aria-hidden="true" />
                <span>{categoryMeta.label}</span>
              </div>
              <span aria-hidden="true">•</span>
              <div className="flex items-center gap-1" aria-label={`Created ${format(flag.createdAt, DATE_TIME_FORMAT)}`}>
                <Calendar className="size-4" aria-hidden="true" />
                <time dateTime={flag.createdAt.toISOString()}>
                  {format(flag.createdAt, DATE_TIME_FORMAT)}
                </time>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border shrink-0',
              statusMeta.color
            )}
            aria-label={`Status: ${statusMeta.label}`}
          >
            {statusMeta.label}
          </span>
        </div>

        {/* Severity and category badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border',
              severityMeta.color
            )}
            aria-label={`Severity: ${severityMeta.label}`}
          >
            <SeverityIcon severity={flag.severity} className="size-4" aria-hidden="true" />
            {severityMeta.label} Severity
          </span>

          {flag.tags && flag.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-muted text-muted-foreground"
              aria-label={`Tag: ${tag}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <Separator />

      {/* Description */}
      <section aria-labelledby="description-heading">
        <h2 id="description-heading" className="sr-only">Description</h2>
        <div className="prose prose-sm max-w-none text-foreground">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {flag.description}
          </p>
        </div>
      </section>

      {/* Reporter info */}
      <section
        className="rounded-lg border border-border bg-muted/30 p-4"
        aria-labelledby="reporter-heading"
      >
        <h2 id="reporter-heading" className="text-sm font-medium text-foreground mb-3">
          Reported By
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {flag.reportedBy.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {flag.reportedBy.email}
            </p>
          </div>
        </div>
      </section>

      {/* Assigned to */}
      {flag.assignedTo && (
        <section
          className="rounded-lg border border-border bg-muted/30 p-4"
          aria-labelledby="assigned-heading"
        >
          <h2 id="assigned-heading" className="text-sm font-medium text-foreground mb-3">
            Assigned To
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {flag.assignedTo.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {flag.assignedTo.email}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Comments */}
      {flag.comments && flag.comments.length > 0 && (
        <section aria-labelledby="comments-heading">
          <h2 id="comments-heading" className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="size-4" aria-hidden="true" />
            Comments ({flag.comments.length})
          </h2>
          <div className="space-y-3">
            {flag.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-border bg-card p-3"
                role="article"
                aria-label={`Comment by ${comment.author.name}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {comment.author.name}
                  </span>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={comment.createdAt.toISOString()}
                  >
                    {format(comment.createdAt, DATE_TIME_FORMAT)}
                  </time>
                </div>
                <p className="text-sm text-muted-foreground">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Attachments */}
      {flag.attachments && flag.attachments.length > 0 && (
        <section aria-labelledby="attachments-heading">
          <h2 id="attachments-heading" className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Paperclip className="size-4" aria-hidden="true" />
            Attachments ({flag.attachments.length})
          </h2>
          <div className="space-y-2">
            {flag.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Download ${attachment.name}`}
              >
                <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(attachment.size)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Flag actions">
        {canResolve && onResolve && (
          <Button
            onClick={() => onResolve(flag)}
            variant="default"
            aria-label="Mark this flag as resolved"
          >
            <CheckCircle className="size-4 mr-2" aria-hidden="true" />
            Resolve
          </Button>
        )}

        {canDismiss && onDismiss && (
          <Button
            onClick={() => onDismiss(flag)}
            variant="outline"
            aria-label="Dismiss this flag"
          >
            <XCircle className="size-4 mr-2" aria-hidden="true" />
            Dismiss
          </Button>
        )}

        {onEdit && (
          <Button
            onClick={() => onEdit(flag)}
            variant="outline"
            aria-label="Edit this flag"
          >
            <Edit className="size-4 mr-2" aria-hidden="true" />
            Edit
          </Button>
        )}

        {onDelete && (
          <Button
            onClick={() => onDelete(flag)}
            variant="outline"
            className="ml-auto text-destructive hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Delete this flag"
          >
            <Trash2 className="size-4 mr-2" aria-hidden="true" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Severity icon helper
 */
function SeverityIcon({ severity, className }: { severity: SecurityFlag['severity']; className?: string }) {
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
 * Format file size in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
