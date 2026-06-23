/**
 * StatusBadge — local pill component for thread status and vendor status.
 *
 * Scoped to this tool; does not depend on the shared TrustBadge from the
 * design system since domain semantics differ.
 */

import { cn } from "@/lib/utils";
import type { ThreadPriority, ThreadStatus, VendorStatus } from "../types";

// ── Thread Status ──────────────────────────────────────────────────────────────

const THREAD_STATUS_META: Record<
  ThreadStatus,
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  },
  "awaiting-reply": {
    label: "Awaiting Reply",
    className: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  },
  resolved: {
    label: "Resolved",
    className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  },
  escalated: {
    label: "Escalated",
    className: "border-red-300/25 bg-red-300/10 text-red-200",
  },
  flagged: {
    label: "Flagged",
    className: "border-orange-300/25 bg-orange-300/10 text-orange-200",
  },
};

interface ThreadStatusBadgeProps {
  status: ThreadStatus;
  className?: string;
}

export function ThreadStatusBadge({ status, className }: ThreadStatusBadgeProps) {
  const meta = THREAD_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

// ── Priority Badge ─────────────────────────────────────────────────────────────

const PRIORITY_META: Record<
  ThreadPriority,
  { label: string; dot: string; text: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-red-400",
    text: "text-red-200",
  },
  high: {
    label: "High",
    dot: "bg-orange-400",
    text: "text-orange-200",
  },
  medium: {
    label: "Medium",
    dot: "bg-amber-400",
    text: "text-amber-200",
  },
  low: {
    label: "Low",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
  },
};

interface PriorityBadgeProps {
  priority: ThreadPriority;
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({
  priority,
  showLabel = true,
  className,
}: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", meta.text, className)}
      aria-label={`Priority: ${meta.label}`}
    >
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", meta.dot)}
        aria-hidden
      />
      {showLabel && (
        <span className="text-[10px] font-medium">{meta.label}</span>
      )}
    </span>
  );
}

// ── Vendor Status Badge ────────────────────────────────────────────────────────

const VENDOR_STATUS_META: Record<
  VendorStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  },
  pending: {
    label: "Pending",
    className: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  },
  paused: {
    label: "Paused",
    className: "border-zinc-300/20 bg-zinc-300/10 text-zinc-300",
  },
  terminated: {
    label: "Terminated",
    className: "border-red-300/25 bg-red-300/10 text-red-300",
  },
};

interface VendorStatusBadgeProps {
  status: VendorStatus;
  className?: string;
}

export function VendorStatusBadge({ status, className }: VendorStatusBadgeProps) {
  const meta = VENDOR_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
