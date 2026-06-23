import type { EmailTemplateListItem, TemplateLibraryActionHandlers } from "../types";

interface TemplateCardProps extends TemplateLibraryActionHandlers {
  template: EmailTemplateListItem;
  selected?: boolean;
}

export function TemplateCard({
  template,
  selected = false,
  onSelectTemplate,
  onCopyTemplate,
  onEditTemplate,
}: TemplateCardProps) {
  const titleId = `email-template-${template.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={`rounded-lg border bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-slate-900 ${
        selected ? "border-slate-900" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700">
              {template.category}
            </span>
            <span className="text-xs text-slate-500">Used {template.usageCount} times</span>
          </div>
          <h3 id={titleId} className="mt-3 text-base font-semibold text-slate-950">
            {template.name}
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-800">{template.subject}</p>
          <p className="mt-2 text-sm text-slate-600">{template.preview}</p>
          <p className="mt-3 text-xs text-slate-500">
            {template.variables.length} variables · Updated{" "}
            <time dateTime={template.updatedAt}>
              {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                new Date(template.updatedAt),
              )}
            </time>
          </p>
        </div>

        <div
          className="grid min-w-32 gap-2 sm:grid-cols-3 lg:grid-cols-1"
          role="group"
          aria-label={`Actions for template ${template.name}`}
        >
          <button
            type="button"
            onClick={() => onSelectTemplate?.(template.id)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`Preview email template ${template.name}`}
            aria-pressed={selected}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => onCopyTemplate?.(template.id)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`Copy email template ${template.name}`}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => onEditTemplate?.(template.id)}
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`Edit email template ${template.name}`}
          >
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}
