import { FileText, Tag } from "lucide-react";
import type { EmailTemplate } from "../types";

interface TemplateCardProps {
  template: EmailTemplate;
  onSelect?: (template: EmailTemplate) => void;
  isSelected?: boolean;
}

export function TemplateCard({ template, onSelect, isSelected = false }: TemplateCardProps) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(template);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (onSelect && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelect(template);
    }
  };

  return (
    <article
      aria-labelledby={`template-${template.id}-name`}
      className={`rounded-lg border bg-white p-4 shadow-sm transition-colors ${
        isSelected
          ? "border-slate-950 bg-slate-50"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      } ${onSelect ? "cursor-pointer" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onSelect ? "button" : "article"}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-md ${
            isSelected ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-base font-semibold text-slate-950"
              id={`template-${template.id}-name`}
            >
              {template.name}
            </h3>
            {template.categoryId && (
              <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                <Tag aria-hidden="true" className="size-3" />
                <span>{template.categoryId}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600 line-clamp-2">{template.subject}</p>
          {template.variables.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-xs font-medium text-slate-500">Variables:</span>
              {template.variables.map((variable) => (
                <span
                  className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700"
                  key={variable.key}
                >
                  {variable.key}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export type { TemplateCardProps };
