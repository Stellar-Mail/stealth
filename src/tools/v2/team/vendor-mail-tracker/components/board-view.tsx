/**
 * BoardView — Kanban-style view grouped by thread status.
 *
 * Columns are rendered as landmark regions (role="region" with aria-label).
 * Cards are keyboard-navigable with Enter/Space activation.
 */

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import type { ThreadStatus, Vendor, VendorThread } from "../types";
import { PriorityBadge, ThreadStatusBadge } from "./status-badge";
import { Calendar, MessageSquare } from "lucide-react";

const BOARD_COLUMNS: { status: ThreadStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "awaiting-reply", label: "Awaiting Reply" },
  { status: "escalated", label: "Escalated" },
  { status: "flagged", label: "Flagged" },
  { status: "resolved", label: "Resolved" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface BoardCardProps {
  thread: VendorThread;
  vendor: Vendor | undefined;
  isSelected: boolean;
  onSelect: () => void;
}

function BoardCard({ thread, vendor, isSelected, onSelect }: BoardCardProps) {
  return (
    <motion.div
      layout
      {...motionPresets.patterns.listItem.entrance}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={[
        thread.unread ? "Unread" : "",
        `Thread: ${thread.subject}`,
        `Vendor: ${vendor?.name ?? "Unknown"}`,
        `Priority: ${thread.priority}`,
      ]
        .filter(Boolean)
        .join(", ")}
      className={cn(
        "cursor-pointer space-y-2 rounded-xl border px-3 py-2.5 transition",
        isSelected
          ? "border-white/20 bg-white/[0.08]"
          : "border-white/[0.06] bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.06]",
        thread.unread && "border-l-2 border-l-amber-400/60",
      )}
    >
      {/* Subject */}
      <p
        className={cn(
          "line-clamp-2 text-xs leading-snug",
          thread.unread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
        )}
      >
        {thread.subject}
      </p>

      {/* Vendor name */}
      <p className="text-[10px] text-muted-foreground truncate">{vendor?.name ?? "—"}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-1">
        <PriorityBadge priority={thread.priority} />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {thread.followUpAt && (
            <span className="inline-flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" aria-hidden />
              {formatDate(thread.followUpAt)}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare className="h-2.5 w-2.5" aria-hidden />
            {thread.messageCount}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface BoardColumnProps {
  status: ThreadStatus;
  label: string;
  threads: VendorThread[];
  vendors: Vendor[];
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
}

function BoardColumn({
  status,
  label,
  threads,
  vendors,
  selectedThreadId,
  onSelect,
}: BoardColumnProps) {
  return (
    <div
      className="flex min-w-[200px] flex-1 flex-col gap-2"
      role="region"
      aria-label={`${label} — ${threads.length} threads`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-0.5">
        <ThreadStatusBadge status={status} />
        <span
          className="text-[10px] font-semibold tabular-nums text-muted-foreground"
          aria-hidden
        >
          {threads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-1.5" role="list" aria-label={`${label} threads`}>
        <AnimatePresence initial={false}>
          {threads.length === 0 ? (
            <motion.div
              key="empty"
              {...motionPresets.entrance.fadeIn()}
              className="rounded-xl border border-dashed border-white/[0.07] px-3 py-4 text-center"
            >
              <p className="text-[11px] text-muted-foreground">No threads</p>
            </motion.div>
          ) : (
            threads.map((thread) => (
              <div key={thread.id} role="listitem">
                <BoardCard
                  thread={thread}
                  vendor={vendors.find((v) => v.id === thread.vendorId)}
                  isSelected={selectedThreadId === thread.id}
                  onSelect={() => onSelect(thread.id)}
                />
              </div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface BoardViewProps {
  threads: VendorThread[];
  vendors: Vendor[];
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
}

export function BoardView({ threads, vendors, selectedThreadId, onSelect }: BoardViewProps) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
      role="region"
      aria-label="Board view of vendor mail threads"
    >
      {BOARD_COLUMNS.map((col) => (
        <BoardColumn
          key={col.status}
          status={col.status}
          label={col.label}
          threads={threads.filter((t) => t.status === col.status)}
          vendors={vendors}
          selectedThreadId={selectedThreadId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
