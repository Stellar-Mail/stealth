/**
 * FilterBar — search + filter controls for the thread list.
 *
 * All interactive controls have visible labels, keyboard support, and
 * accessible focus rings via the project's `.glow-ring` utility.
 */

import { LayoutList, Rows3, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TrackingFilter,
  ThreadPriority,
  ThreadStatus,
  VendorCategory,
  Vendor,
  ViewMode,
} from "../types";

interface FilterBarProps {
  filter: TrackingFilter;
  vendors: Vendor[];
  viewMode: ViewMode;
  onFilterChange: (patch: Partial<TrackingFilter>) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onReset: () => void;
  onAddThread: () => void;
  onAddVendor: () => void;
}

const STATUS_OPTIONS: { value: TrackingFilter["status"]; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "awaiting-reply", label: "Awaiting Reply" },
  { value: "escalated", label: "Escalated" },
  { value: "flagged", label: "Flagged" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_OPTIONS: { value: TrackingFilter["priority"]; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS: { value: TrackingFilter["category"]; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "software", label: "Software" },
  { value: "marketing", label: "Marketing" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "hr", label: "HR" },
  { value: "logistics", label: "Logistics" },
  { value: "other", label: "Other" },
];

const selectClass =
  "glow-ring h-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0 text-xs text-foreground outline-none focus:border-white/20 appearance-none cursor-pointer";

export function FilterBar({
  filter,
  vendors,
  viewMode,
  onFilterChange,
  onViewModeChange,
  onReset,
  onAddThread,
  onAddVendor,
}: FilterBarProps) {
  const isFiltered =
    filter.query.trim() !== "" ||
    filter.status !== "all" ||
    filter.priority !== "all" ||
    filter.category !== "all" ||
    filter.vendorId !== "all";

  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap"
      role="search"
      aria-label="Filter vendor mail threads"
    >
      {/* Search input */}
      <div className="relative flex-1 min-w-[180px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="vmt-search" className="sr-only">
          Search threads by subject, keyword, or tag
        </label>
        <input
          id="vmt-search"
          type="search"
          value={filter.query}
          onChange={(e) => onFilterChange({ query: e.target.value })}
          placeholder="Search subject, tags…"
          className="glow-ring h-8 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-white/20"
          autoComplete="off"
        />
        {filter.query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onFilterChange({ query: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>

      {/* Status filter */}
      <label className="sr-only" htmlFor="vmt-status-filter">
        Filter by thread status
      </label>
      <select
        id="vmt-status-filter"
        value={filter.status}
        onChange={(e) => onFilterChange({ status: e.target.value as TrackingFilter["status"] })}
        className={selectClass}
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Priority filter */}
      <label className="sr-only" htmlFor="vmt-priority-filter">
        Filter by thread priority
      </label>
      <select
        id="vmt-priority-filter"
        value={filter.priority}
        onChange={(e) =>
          onFilterChange({ priority: e.target.value as TrackingFilter["priority"] })
        }
        className={selectClass}
        aria-label="Filter by priority"
      >
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Category filter */}
      <label className="sr-only" htmlFor="vmt-category-filter">
        Filter by vendor category
      </label>
      <select
        id="vmt-category-filter"
        value={filter.category}
        onChange={(e) =>
          onFilterChange({ category: e.target.value as VendorCategory | "all" })
        }
        className={selectClass}
        aria-label="Filter by category"
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {isFiltered && (
        <button
          type="button"
          onClick={onReset}
          className="glow-ring inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
          aria-label="Clear all filters"
        >
          <X className="h-3 w-3" aria-hidden />
          Clear
        </button>
      )}

      {/* Spacer */}
      <span className="flex-1 hidden sm:block" aria-hidden />

      {/* View mode toggle */}
      <div
        className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
        role="group"
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          aria-pressed={viewMode === "list"}
          aria-label="List view"
          className={cn(
            "glow-ring inline-flex h-7 w-7 items-center justify-center rounded-md transition",
            viewMode === "list"
              ? "bg-white/[0.10] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutList className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("board")}
          aria-pressed={viewMode === "board"}
          aria-label="Board view"
          className={cn(
            "glow-ring inline-flex h-7 w-7 items-center justify-center rounded-md transition",
            viewMode === "board"
              ? "bg-white/[0.10] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Rows3 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* Add thread */}
      <button
        type="button"
        onClick={onAddThread}
        className="glow-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-medium text-foreground/90 transition hover:bg-white/[0.10]"
        aria-label="Add a new mail thread"
      >
        + Thread
      </button>

      {/* Add vendor */}
      <button
        type="button"
        onClick={onAddVendor}
        className="glow-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/80 bg-white px-3 text-xs font-semibold text-zinc-950 transition hover:opacity-90"
        aria-label="Add a new vendor"
      >
        + Vendor
      </button>
    </div>
  );
}
