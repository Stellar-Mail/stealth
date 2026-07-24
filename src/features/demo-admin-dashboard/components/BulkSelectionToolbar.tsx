import { CheckSquare, ListChecks, RotateCcw, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Draft } from "../types/draft";
import {
  clearBulkSelection,
  formatBulkSelectionSummary,
  getBulkSelectionSummary,
  invertBulkSelection,
  selectAllDrafts,
} from "../bulkSelection";

export interface BulkSelectionToolbarProps {
  drafts: Draft[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  className?: string;
}

export function BulkSelectionToolbar({
  drafts,
  selectedIds,
  onSelectionChange,
  className,
}: BulkSelectionToolbarProps) {
  const summary = getBulkSelectionSummary(drafts, selectedIds);
  const disabled = drafts.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">Bulk selection</span>
        <span className="text-muted-foreground">{formatBulkSelectionSummary(summary)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || summary.allSelected}
          onClick={() => onSelectionChange(selectAllDrafts(drafts).selectedIds)}
          className={toolbarButtonClass(disabled || summary.allSelected)}
        >
          <CheckSquare className="h-4 w-4" />
          Select all
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectionChange(invertBulkSelection(drafts, selectedIds).selectedIds)}
          className={toolbarButtonClass(disabled)}
        >
          <RotateCcw className="h-4 w-4" />
          Invert
        </button>
        <button
          type="button"
          disabled={disabled || summary.selectedCount === 0}
          onClick={() => onSelectionChange(clearBulkSelection().selectedIds)}
          className={toolbarButtonClass(disabled || summary.selectedCount === 0)}
        >
          {summary.partiallySelected ? <Square className="h-4 w-4" /> : <X className="h-4 w-4" />}
          Clear
        </button>
      </div>
    </div>
  );
}

function toolbarButtonClass(disabled: boolean): string {
  return cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
    disabled
      ? "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60"
      : "border-white/[0.08] text-foreground hover:bg-white/[0.04]",
  );
}
