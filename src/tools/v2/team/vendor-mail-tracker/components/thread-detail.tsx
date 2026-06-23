/**
 * ThreadDetail — right panel showing selected thread info.
 *
 * Renders a loading skeleton when no thread is selected.
 * Full metadata, tags, follow-up date, and action buttons are shown.
 */

import { Calendar, CheckCheck, ExternalLink, Flag, MessageSquare, Tag, X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import { SkeletonBlock, SkeletonText } from "@/features/design-system";
import type { Vendor, VendorThread } from "../types";
import { PriorityBadge, ThreadStatusBadge, VendorStatusBadge } from "./status-badge";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Empty / placeholder ─────────────────────────────────────────────────────

function NoSelection() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center"
      role="status"
      aria-label="No thread selected"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
        <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground/70">No thread selected</p>
        <p className="mt-1 text-xs text-muted-foreground">Select a thread to view its details.</p>
      </div>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading thread details"
      className="space-y-5 p-5"
    >
      <SkeletonBlock className="h-5 w-3/4 rounded-sm" />
      <SkeletonBlock className="h-3.5 w-32 rounded-sm opacity-70" />
      <div className="flex gap-2 pt-1">
        <SkeletonBlock className="h-5 w-16 rounded-full" />
        <SkeletonBlock className="h-5 w-12 rounded-full opacity-70" />
      </div>
      <div className="space-y-2.5 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <SkeletonBlock className="h-3 w-20 rounded-sm opacity-60" />
            <SkeletonBlock className="h-3 w-24 rounded-sm" />
          </div>
        ))}
      </div>
      <SkeletonText lines={3} lastLineWidthClass="w-3/4" />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface ThreadDetailProps {
  thread: VendorThread | null;
  vendor: Vendor | undefined | null;
  isLoading?: boolean;
  onResolve: (id: string) => void;
  onClose: () => void;
}

export function ThreadDetail({ thread, vendor, isLoading, onResolve, onClose }: ThreadDetailProps) {
  if (isLoading) return <DetailSkeleton />;
  if (!thread) return <NoSelection />;

  const isOverdue =
    thread.followUpAt && new Date(thread.followUpAt) < new Date();

  return (
    <motion.div
      key={thread.id}
      {...motionPresets.entrance.fadeIn()}
      className="space-y-4 p-5"
      role="region"
      aria-label={`Thread detail: ${thread.subject}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-snug text-foreground">
            {thread.subject}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{vendor?.name ?? "Unknown vendor"}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread detail"
          className="glow-ring shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* Status + Priority */}
      <div className="flex flex-wrap items-center gap-2">
        <ThreadStatusBadge status={thread.status} />
        <PriorityBadge priority={thread.priority} />
        {thread.unread && (
          <span className="inline-flex items-center rounded-full border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
            Unread
          </span>
        )}
      </div>

      {/* Metadata table */}
      <div
        className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 space-y-2.5"
        aria-label="Thread metadata"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-white/[0.05] pb-1.5">
          Details
        </p>

        {[
          { label: "Vendor", value: vendor?.name ?? "—" },
          { label: "Category", value: vendor?.category ?? "—" },
          { label: "Last message", value: formatDateTime(thread.lastMessageAt) },
          { label: "Messages", value: `${thread.messageCount}` },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground/80 font-medium text-right">{value}</span>
          </div>
        ))}

        {thread.followUpAt && (
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden />
              Follow-up
            </span>
            <span
              className={cn(
                "font-medium",
                isOverdue ? "text-red-300" : "text-foreground/80",
              )}
            >
              {formatDateTime(thread.followUpAt)}
              {isOverdue && " (overdue)"}
            </span>
          </div>
        )}

        {vendor && (
          <div className="flex justify-between gap-4 text-xs pt-0.5">
            <span className="text-muted-foreground">Vendor status</span>
            <VendorStatusBadge status={vendor.status} />
          </div>
        )}
      </div>

      {/* Excerpt */}
      <div
        className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 space-y-1.5"
        aria-label="Thread excerpt"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Last message excerpt
        </p>
        <p className="text-xs leading-relaxed text-foreground/70">{thread.excerpt}</p>
      </div>

      {/* Tags */}
      {thread.tags.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="list"
          aria-label="Thread tags"
        >
          <Tag className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          {thread.tags.map((tag) => (
            <span
              key={tag}
              role="listitem"
              className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Vendor address */}
      {vendor?.address && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vendor address
          </p>
          <p className="text-xs text-foreground/70">{vendor.address}</p>
        </div>
      )}

      {/* Notes */}
      {vendor?.notes && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </p>
          <p className="text-xs text-foreground/70 leading-relaxed">{vendor.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1" role="group" aria-label="Thread actions">
        {thread.status !== "resolved" && (
          <button
            type="button"
            onClick={() => onResolve(thread.id)}
            className="glow-ring flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-300/15"
            aria-label="Mark this thread as resolved"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Mark as Resolved
          </button>
        )}

        {thread.status === "escalated" && (
          <button
            type="button"
            className="glow-ring flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-300/10 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-300/15"
            aria-label="View escalation details — opens in Stellar explorer (future integration)"
            disabled
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
            Escalation Details
            <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
          </button>
        )}

        <button
          type="button"
          className="glow-ring flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-medium text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
          aria-label="Open thread in mail view — requires main app integration (not yet linked)"
          disabled
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open in Mail
          <span className="ml-auto rounded border border-white/[0.08] bg-white/[0.03] px-1 py-0.5 text-[9px] opacity-60">
            V3
          </span>
        </button>
      </div>
    </motion.div>
  );
}
