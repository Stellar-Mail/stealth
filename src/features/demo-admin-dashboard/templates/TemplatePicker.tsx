import { useMemo, useState } from "react";
import { Check, FileText, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Draft } from "../types/draft";
import { messageTemplates } from "./messageTemplates";
import { searchTemplates } from "./templateSearch";
import { insertTemplate, isTemplateInserted, removeDraft } from "./templateToDraft";
import { TEMPLATE_CATEGORY_LABEL, type MessageTemplate } from "./types";

interface TemplatePickerProps {
  /** Override the template source; defaults to the bundled demo templates. */
  templates?: MessageTemplate[];
  /** Seed the draft dataset (e.g. for previews/tests). */
  initialDataset?: Draft[];
  /** Controlled active draft dataset. */
  dataset?: Draft[];
  /** Notified whenever the draft dataset changes (insert/remove). */
  onDatasetChange?: (dataset: Draft[]) => void;
  className?: string;
}

/**
 * Admin UI for choosing a message template and inserting it into the draft
 * dataset that populates the demo inbox. Three regions: searchable list,
 * detail preview, and the accumulated draft dataset.
 */
export function TemplatePicker({
  templates = messageTemplates,
  initialDataset = [],
  dataset: propDataset,
  onDatasetChange,
  className,
}: TemplatePickerProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [internalDataset, setInternalDataset] = useState<Draft[]>(initialDataset);

  const dataset = propDataset !== undefined ? propDataset : internalDataset;

  const results = useMemo(() => searchTemplates(templates, query), [templates, query]);
  const selected = templates.find((template) => template.id === selectedId) ?? results[0] ?? null;
  const alreadyInserted = selected ? isTemplateInserted(dataset, selected) : false;

  const commitDataset = (next: Draft[]) => {
    if (propDataset === undefined) {
      setInternalDataset(next);
    }
    onDatasetChange?.(next);
  };

  const handleInsert = () => {
    if (!selected) return;
    const result = insertTemplate(dataset, selected);
    if (result.ok) commitDataset(result.dataset);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground">
        Pick a message template and insert it into the draft dataset. All templates are synthetic
        demo content.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ── Searchable template list ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates…"
              aria-label="Search message templates"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
          </div>
          <ul
            className="max-h-80 overflow-y-auto p-1.5"
            role="listbox"
            aria-label="Message templates"
          >
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No templates match “{query}”.
              </li>
            )}
            {results.map((template) => {
              const active = selected?.id === template.id;
              const inserted = isTemplateInserted(dataset, template);
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(template.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                      active ? "bg-white/[0.07] ring-1 ring-white/10" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {template.name}
                        </span>
                        {inserted && <Check className="h-3 w-3 shrink-0 text-emerald-400" />}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {TEMPLATE_CATEGORY_LABEL[template.category]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Detail preview ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {TEMPLATE_CATEGORY_LABEL[selected.category]}
                  </span>
                  <h4 className="mt-2 text-sm font-semibold text-foreground">{selected.name}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
                </div>
                <button
                  type="button"
                  onClick={handleInsert}
                  disabled={alreadyInserted}
                  title={alreadyInserted ? "Already in the draft dataset" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    alreadyInserted
                      ? "cursor-not-allowed bg-white/[0.04] text-muted-foreground"
                      : "bg-foreground text-background hover:opacity-90",
                  )}
                >
                  {alreadyInserted ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Inserted
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Insert draft
                    </>
                  )}
                </button>
              </div>

              <dl className="mt-3 space-y-2 border-t border-white/[0.06] pt-3 text-xs">
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd className="text-foreground">{selected.subject}</dd>
                </div>
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <dt className="text-muted-foreground">To</dt>
                  <dd className="font-mono text-[11px] text-foreground">
                    {selected.recipients.join(", ")}
                  </dd>
                </div>
              </dl>

              <pre className="mt-3 max-h-44 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-3 font-sans text-xs leading-5 text-foreground/90">
                {selected.body}
              </pre>

              <div className="mt-2 flex flex-wrap gap-1">
                {selected.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a template to preview it.</p>
          )}
        </div>
      </div>

      {/* ── Draft dataset ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">
            Draft dataset{" "}
            <span className="text-muted-foreground tabular-nums">({dataset.length})</span>
          </h4>
          {dataset.length > 0 && (
            <button
              type="button"
              onClick={() => commitDataset([])}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        {dataset.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No drafts yet. Insert a template above to populate the demo inbox dataset.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {dataset.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center gap-2 rounded-lg border border-white/[0.04] px-3 py-2"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{draft.subject}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {draft.recipients.join(", ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => commitDataset(removeDraft(dataset, draft.id))}
                  aria-label={`Remove ${draft.subject} from dataset`}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
