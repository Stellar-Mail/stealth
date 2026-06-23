import { useMemo, useState } from "react";
import { Filter, Plus } from "lucide-react";
import type { Macro, MacroCategory } from "../services/macro.service";
import { MacroCard } from "./MacroCard";
import { MacroSummary } from "./MacroSummary";
import { MacroToolEmptyState } from "./MacroToolEmptyState";
import { MacroToolErrorState } from "./MacroToolErrorState";
import { MacroToolLoadingState } from "./MacroToolLoadingState";

type MacroToolViewState = "loading" | "error" | "ready";
type CategoryFilter = "all" | MacroCategory;

interface MacroToolPanelProps {
  errorMessage?: string;
  initialState?: MacroToolViewState;
  macros?: Macro[];
  onCreateMacro?: () => void;
  onEditMacro?: (macro: Macro) => void;
  onRetry?: () => void;
  onToggleFavorite?: (macro: Macro) => void;
  onUseMacro?: (macro: Macro) => void;
}

const categoryOptions: Array<{ label: string; value: CategoryFilter }> = [
  { label: "All", value: "all" },
  { label: "Greeting", value: "greeting" },
  { label: "Billing", value: "billing" },
  { label: "Technical", value: "technical" },
  { label: "Shipping", value: "shipping" },
  { label: "Refund", value: "refund" },
  { label: "General", value: "general" },
];

function includesQuery(macro: Macro, query: string): boolean {
  const haystack = [macro.title, macro.body, ...macro.tags].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase().trim());
}

export function MacroToolPanel({
  errorMessage,
  initialState = "ready",
  macros = [],
  onCreateMacro,
  onEditMacro,
  onRetry,
  onToggleFavorite,
  onUseMacro,
}: MacroToolPanelProps) {
  const [viewState, setViewState] = useState<MacroToolViewState>(initialState);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const filteredMacros = useMemo(
    () =>
      macros.filter((macro) => {
        const categoryMatch = category === "all" || macro.category === category;
        const queryMatch = !query || includesQuery(macro, query);
        return categoryMatch && queryMatch;
      }),
    [category, macros, query],
  );

  const summary = useMemo(() => {
    const visibleCategories = [...new Set(macros.map((macro) => macro.category))];
    const totalUsage = macros.reduce((total, macro) => total + macro.usageCount, 0);
    const favorites = macros.filter((macro) => macro.isFavorite).length;
    return { favorites, totalUsage, visibleCategories };
  }, [macros]);

  if (viewState === "loading") {
    return <MacroToolLoadingState />;
  }

  if (viewState === "error") {
    return (
      <MacroToolErrorState
        details={errorMessage}
        onRetry={onRetry ?? (() => setViewState("ready"))}
      />
    );
  }

  if (macros.length === 0) {
    return (
      <MacroToolEmptyState
        action={
          onCreateMacro ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={onCreateMacro}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              New macro
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="support-macro-tool-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Team V1 tool</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="support-macro-tool-title">
            Customer Support Macro Tool
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Search reusable replies, apply customer variables, and keep frequent responses
            consistent across the support team.
          </p>
        </div>
        {onCreateMacro ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            onClick={onCreateMacro}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            New macro
          </button>
        ) : null}
      </header>

      <MacroSummary
        favorites={summary.favorites}
        total={macros.length}
        totalUsage={summary.totalUsage}
        visibleCategories={summary.visibleCategories}
      />

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="text-sm font-medium text-slate-800" htmlFor="macro-search">
            Search macros
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            id="macro-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, body, or tag"
            type="search"
            value={query}
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter aria-hidden="true" className="size-4" />
            Filter category
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Macro category filter</legend>
            {categoryOptions.map((option) => (
              <label
                className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  category === option.value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                key={option.value}
              >
                <input
                  checked={category === option.value}
                  className="sr-only"
                  name="macro-category-filter"
                  onChange={() => setCategory(option.value)}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      {filteredMacros.length > 0 ? (
        <div aria-label="Customer support macros" className="space-y-3" role="list">
          {filteredMacros.map((macro) => (
            <div key={macro.id} role="listitem">
              <MacroCard
                macro={macro}
                onEdit={onEditMacro}
                onToggleFavorite={onToggleFavorite}
                onUse={onUseMacro}
              />
            </div>
          ))}
        </div>
      ) : (
        <MacroToolEmptyState
          description="No macros match the current search or category filter."
          title="No matching macros"
        />
      )}
    </section>
  );
}

export type { MacroToolPanelProps };
