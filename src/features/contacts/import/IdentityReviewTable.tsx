import { useState, useMemo, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validateImportAddress } from "./csvParser";
import type { ImportedContactRow } from "./types";
import { classifyMatches } from "./identityMatcher";

type Props = {
  rows: ImportedContactRow[];
  onChange: (rows: ImportedContactRow[]) => void;
};

const TRUST_COLORS: Record<string, string> = {
  allow: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
  block: "border-red-400/20 bg-red-400/[0.06] text-red-300",
  default: "border-white/10 bg-white/[0.04] text-muted-foreground",
};

const MATCH_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  exact: {
    label: "Matched",
    color: "text-emerald-400",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  fuzzy: {
    label: "Similar",
    color: "text-sky-400",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
  },
  ambiguous: {
    label: "Review needed",
    color: "text-amber-400",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  none: {
    label: "New",
    color: "text-muted-foreground",
    icon: <Users className="h-3.5 w-3.5" />,
  },
};

export function IdentityReviewTable({ rows, onChange }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const classified = useMemo(() => classifyMatches(rows), [rows]);
  const { exact, fuzzy, ambiguous, none } = classified;

  const filtered = useMemo(() => {
    let result = rows;
    if (filter === "exact") result = exact;
    else if (filter === "fuzzy") result = fuzzy;
    else if (filter === "ambiguous") result = ambiguous;
    else if (filter === "none") result = none;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, exact, fuzzy, ambiguous, none, filter, search]);

  const updateRow = useCallback(
    (id: string, patch: Partial<ImportedContactRow>) => {
      onChange(
        rows.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, ...patch };
          if ("address" in patch) {
            updated.error = validateImportAddress(patch.address ?? "");
          }
          return updated;
        }),
      );
    },
    [onChange, rows],
  );

  const removeRow = useCallback(
    (id: string) => {
      onChange(rows.filter((r) => r.id !== id));
    },
    [onChange, rows],
  );

  const ambiguousCount = ambiguous.length;
  const hasAmbiguous = ambiguousCount > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          Review contacts & identity matches
        </h2>
        <p className="text-sm text-muted-foreground">
          Ambiguous matches are highlighted for review. They will never be auto-approved.
        </p>
      </div>

      {hasAmbiguous && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-200">
            <span className="font-medium">
              {ambiguousCount} ambiguous match{ambiguousCount !== 1 ? "es" : ""}
            </span>{" "}
            require your review. We found similar names with different addresses — these may be
            different people.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address…"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* filter tabs */}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {[
          { key: "all", label: `All (${rows.length})` },
          { key: "exact", label: `Matched (${exact.length})` },
          { key: "fuzzy", label: `Similar (${fuzzy.length})` },
          { key: "ambiguous", label: `Review (${ambiguous.length})` },
          { key: "none", label: `New (${none.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              "rounded-md border px-2 py-0.5 transition",
              filter === t.key
                ? "border-white/20 bg-white/[0.08] text-foreground"
                : "border-white/5 text-muted-foreground hover:border-white/10 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* rows */}
      <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-0.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Users className="h-6 w-6" />
            <p className="text-xs">No contacts in this filter.</p>
          </div>
        )}
        {filtered.map((row) => {
          const meta = row.match ? MATCH_META[row.match.type] : MATCH_META.none;
          return (
            <div
              key={row.id}
              className={cn(
                "rounded-xl border p-3 space-y-2 transition",
                row.error
                  ? "border-red-400/20 bg-red-400/[0.03]"
                  : row.match?.type === "ambiguous"
                    ? "border-amber-400/20 bg-amber-400/[0.03]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className={cn("shrink-0", meta.color)}>{meta.icon}</span>
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    placeholder="Name"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20"
                  />
                </div>
                <select
                  value={row.trust}
                  onChange={(e) =>
                    updateRow(row.id, { trust: e.target.value as ImportedContactRow["trust"] })
                  }
                  className={cn(
                    "appearance-none rounded-md border px-2 py-0.5 pr-5 text-[11px] font-medium transition",
                    TRUST_COLORS[row.trust],
                  )}
                >
                  <option value="allow">Allow</option>
                  <option value="default">Default</option>
                  <option value="block">Block</option>
                </select>
                <button
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove contact"
                  className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <input
                value={row.address}
                onChange={(e) => updateRow(row.id, { address: e.target.value })}
                placeholder="alice*stealth.xyz or GABC…"
                className={cn(
                  "w-full rounded-lg border bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-white/20",
                  row.error ? "border-red-400/30 text-red-300" : "border-white/10 text-foreground",
                )}
              />

              <div className="flex items-center gap-2 text-[10px]">
                {row.match && (
                  <span className={cn("flex items-center gap-1", meta.color)}>
                    {meta.icon}
                    {meta.label}: {row.match.reason}
                  </span>
                )}
                {row.error && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {row.error}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
