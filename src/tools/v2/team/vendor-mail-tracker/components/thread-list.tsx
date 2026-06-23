/**
 * ThreadList — scrollable list of vendor mail threads with sorting header.
 *
 * Handles the empty, loading, and error display states.
 * Passes aria roles: role="list" on the list, sortable column headers are
 * <button> elements with aria-sort attributes.
 */

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import { SkeletonBlock, SkeletonText } from "@/features/design-system";
import type { SortDir, SortField, Vendor, VendorThread } from "../types";
import { ThreadRow } from "./thread-row";

// ── Sort header button ──────────────────────────────────────────────────────

interface SortButtonProps {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
}

function SortButton({ field, label, currentField, currentDir, onSort }: SortButtonProps) {
  const active = currentField === field;
  const ariaSort: React.AriaAttributes["aria-sort"] = active
    ? currentDir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-sort={ariaSort}
      className={cn(
        "glow-ring inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
        active ? "text-foreground/80" : "text-muted-foreground hover:text-foreground/60",
      )}
    >
      {label}
      {active ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-2.5 w-2.5" aria-hidden />
        ) : (
          <ArrowDown className="h-2.5 w-2.5" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-2.5 w-2.5 opacity-40" aria-hidden />
      )}
    </button>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function ThreadListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading threads" className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3"
          aria-hidden="true"
        >
          <SkeletonBlock className="mt-1 h-2 w-2 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <SkeletonBlock className="h-3.5 w-48 rounded-sm" />
              <SkeletonBlock className="h-3 w-10 rounded-sm shrink-0 opacity-60" />
            </div>
            <SkeletonBlock className="h-3 w-28 rounded-sm opacity-70" />
            <SkeletonText lines={1} lastLineWidthClass="w-4/5" />
            <div className="flex items-center gap-2 pt-0.5">
              <SkeletonBlock className="h-4 w-16 rounded-full" />
              <SkeletonBlock className="h-4 w-20 rounded-full opacity-60" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

interface EmptyThreadsProps {
  isFiltered: boolean;
  onReset: () => void;
}

function EmptyThreads({ isFiltered, onReset }: EmptyThreadsProps) {
  return (
    <motion.div
      {...motionPresets.entrance.fadeIn()}
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="status"
      aria-live="polite"
      aria-label={isFiltered ? "No threads match your filters" : "No threads tracked yet"}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground/80">
          {isFiltered ? "No threads match" : "No threads yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isFiltered
            ? "Try adjusting your filters to see more results."
            : "Threads you add or track will appear here."}
        </p>
      </div>
      {isFiltered && (
        <button
          type="button"
          onClick={onReset}
          className="glow-ring rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-foreground/80 transition hover:bg-white/[0.05] hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </motion.div>
  );
}

// ── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <motion.div
      {...motionPresets.entrance.fadeIn()}
      className="flex flex-col items-center gap-3 py-14 text-center"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm text-red-200">{message}</p>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface ThreadListProps {
  threads: VendorThread[];
  vendors: Vendor[];
  isLoading: boolean;
  error: string | null;
  selectedThreadId: string | null;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onSelect: (id: string) => void;
  onResolve: (id: string) => void;
  onReset: () => void;
  isFiltered: boolean;
}

export function ThreadList({
  threads,
  vendors,
  isLoading,
  error,
  selectedThreadId,
  sortField,
  sortDir,
  onSort,
  onSelect,
  onResolve,
  onReset,
  isFiltered,
}: ThreadListProps) {
  if (error) return <ErrorState message={error} />;
  if (isLoading) return <ThreadListSkeleton />;

  return (
    <div className="space-y-2">
      {/* Sort controls header */}
      <div
        className="flex items-center gap-3 px-1"
        role="row"
        aria-label="Sort threads"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sort:
        </span>
        <SortButton
          field="lastMessageAt"
          label="Recent"
          currentField={sortField}
          currentDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          field="priority"
          label="Priority"
          currentField={sortField}
          currentDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          field="vendor"
          label="Vendor"
          currentField={sortField}
          currentDir={sortDir}
          onSort={onSort}
        />
        <SortButton
          field="followUpAt"
          label="Follow-up"
          currentField={sortField}
          currentDir={sortDir}
          onSort={onSort}
        />
        <span className="ml-auto text-[10px] text-muted-foreground" aria-live="polite">
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
        </span>
      </div>

      {/* List */}
      <AnimatePresence mode="popLayout" initial={false}>
        {threads.length === 0 ? (
          <EmptyThreads isFiltered={isFiltered} onReset={onReset} />
        ) : (
          <ul
            className="space-y-1.5"
            role="list"
            aria-label="Vendor mail threads"
            aria-live="polite"
            aria-atomic="false"
          >
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                vendor={vendors.find((v) => v.id === thread.vendorId)}
                isSelected={selectedThreadId === thread.id}
                onSelect={() => onSelect(thread.id)}
                onResolve={() => onResolve(thread.id)}
              />
            ))}
          </ul>
        )}
      </AnimatePresence>
    </div>
  );
}
