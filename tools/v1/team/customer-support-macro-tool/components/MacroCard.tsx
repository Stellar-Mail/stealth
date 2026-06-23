import { Edit3, Play, Star } from "lucide-react";
import type { Macro } from "../services/macro.service";

interface MacroCardProps {
  macro: Macro;
  onEdit?: (macro: Macro) => void;
  onToggleFavorite?: (macro: Macro) => void;
  onUse?: (macro: Macro) => void;
}

const categoryStyles: Record<Macro["category"], string> = {
  greeting: "border-blue-200 bg-blue-50 text-blue-800",
  billing: "border-emerald-200 bg-emerald-50 text-emerald-800",
  technical: "border-violet-200 bg-violet-50 text-violet-800",
  shipping: "border-cyan-200 bg-cyan-50 text-cyan-800",
  refund: "border-amber-200 bg-amber-50 text-amber-800",
  general: "border-slate-200 bg-slate-50 text-slate-700",
};

export function MacroCard({ macro, onEdit, onToggleFavorite, onUse }: MacroCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-950">{macro.title}</h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${categoryStyles[macro.category]}`}
            >
              {macro.category}
            </span>
            {macro.isFavorite ? (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                favorite
              </span>
            ) : null}
          </div>
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {macro.body}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {macro.tags.map((tag) => (
              <span className="rounded-md bg-slate-100 px-2 py-1" key={tag}>
                {tag}
              </span>
            ))}
            <span className="rounded-md bg-slate-100 px-2 py-1">
              used {macro.usageCount} times
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          {onUse ? (
            <button
              aria-label={`Apply macro ${macro.title}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onUse(macro)}
              type="button"
            >
              <Play aria-hidden="true" className="size-4" />
              Apply
            </button>
          ) : null}
          {onToggleFavorite ? (
            <button
              aria-label={`${macro.isFavorite ? "Remove favorite from" : "Favorite"} ${macro.title}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onToggleFavorite(macro)}
              type="button"
            >
              <Star aria-hidden="true" className="size-4" />
              Favorite
            </button>
          ) : null}
          {onEdit ? (
            <button
              aria-label={`Edit macro ${macro.title}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-950"
              onClick={() => onEdit(macro)}
              type="button"
            >
              <Edit3 aria-hidden="true" className="size-4" />
              Edit
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export type { MacroCardProps };
