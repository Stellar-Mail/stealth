import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminSearchBarProps {
  /** Current search query (controlled). */
  value: string;
  /** Called whenever the query changes. */
  onChange: (value: string) => void;
  /** Number of rows matching the current query. */
  resultCount: number;
  /** Total number of rows before filtering. */
  totalCount: number;
  /** Optional placeholder text. */
  placeholder?: string;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

/**
 * Local search bar for demo-admin dashboard tables and pickers.
 * Controlled and presentational: filtering happens in the parent via
 * filterRows, so this stays reusable across different tables.
 */
export function AdminSearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  placeholder = "Search demo data…",
  className,
}: AdminSearchBarProps) {
  const hasQuery = value.trim().length > 0;
  const noun = resultCount === 1 ? "result" : "results";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          role="searchbox"
          aria-label="Search demo data"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-white/20"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 rounded-lg p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
        {hasQuery ? (
          <>
            <span className="text-foreground">{resultCount}</span> {noun} of {totalCount}
          </>
        ) : (
          <>
            <span className="text-foreground">{totalCount}</span> total
          </>
        )}
      </p>
    </div>
  );
}
