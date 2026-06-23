/**
 * ThreadRow — a single mail thread row in the list view.
 *
 * Keyboard: Enter or Space activates selection.
 * Screen readers: announced as a listitem with key metadata via aria-label.
 */

import { Calendar, CheckCheck, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import type { Vendor, VendorThread } from "../types";
import { PriorityBadge, ThreadStatusBadge } from "./status-badge";

interface ThreadRowProps {
  thread: VendorThread;
  vendor: Vendor | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onResolve: () => void;
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFollowUp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ThreadRow({ thread, vendor, isSelected, onSelect, onResolve }: ThreadRowProps) {
  const isOverdue =
    thread.followUpAt && new Date(thread.followUpAt) < new Date();
  const isDueSoon =
    thread.followUpAt &&
    !isOverdue &&
    new Date(thread.followUpAt) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  const ariaLabel = [
    thread.unread ? "Unread" : "",
    `Thread: ${thread.subject}`,
    `from ${vendor?.name ?? "Unknown vendor"}`,
    `Status: ${thread.status}`,
    `Priority: ${thread.priority}`,
    thread.followUpAt ? `Follow-up ${formatFollowUp(thread.followUpAt)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <motion.li
      layout
      {...motionPresets.patterns.listItem.entrance}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border px-3 py-3 transition cursor-pointer",
        isSelected
          ? "border-white/20 bg-white/[0.07]"
          : "border-white/[0.05] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]",
        thread.unread && "border-l-2 border-l-amber-400/60",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
    >
      {/* Unread indicator */}
      {thread.unread && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-400 translate-x-[-3px]"
          aria-hidden
        />
      )}

      {/* Priority dot */}
      <div className="mt-1 shrink-0">
        <PriorityBadge priority={thread.priority} showLabel={false} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm leading-snug",
                thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
              )}
            >
              {thread.subject}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {vendor?.name ?? "—"}
              {vendor && (
                <span className="ml-1.5 rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 text-[9px] uppercase tracking-wide">
                  {vendor.category}
                </span>
              )}
            </p>
          </div>
          <time
            dateTime={thread.lastMessageAt}
            className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap"
          >
            {formatRelativeDate(thread.lastMessageAt)}
          </time>
        </div>

        {/* Excerpt */}
        <p className="line-clamp-1 text-[11px] text-muted-foreground leading-relaxed">
          {thread.excerpt}
        </p>

        {/* Footer row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <ThreadStatusBadge status={thread.status} />

          {thread.followUpAt && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                isOverdue
                  ? "border-red-300/25 bg-red-300/10 text-red-200"
                  : isDueSoon
                    ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground",
              )}
              aria-label={`Follow-up due ${formatFollowUp(thread.followUpAt)}${isOverdue ? " — overdue" : ""}`}
            >
              <Calendar className="h-2.5 w-2.5" aria-hidden />
              {formatFollowUp(thread.followUpAt)}
              {isOverdue && " overdue"}
            </span>
          )}

          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <MessageSquare className="h-2.5 w-2.5" aria-hidden />
            {thread.messageCount}
          </span>

          {/* Tags (first 2 only) */}
          {thread.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 text-[9px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}

          {/* Quick resolve (shown on hover/focus) */}
          {thread.status !== "resolved" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              aria-label={`Mark "${thread.subject}" as resolved`}
              className="glow-ring ml-auto inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition hover:border-emerald-300/20 hover:bg-emerald-300/10 hover:text-emerald-200 focus:opacity-100 group-hover:opacity-100"
            >
              <CheckCheck className="h-2.5 w-2.5" aria-hidden />
              Resolve
            </button>
          )}
        </div>
      </div>
    </motion.li>
  );
}
