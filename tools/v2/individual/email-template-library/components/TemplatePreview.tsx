import { Mail } from "lucide-react";
import type { EmailTemplate } from "../types";

interface TemplatePreviewProps {
  template: EmailTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  return (
    <section
      aria-labelledby={`template-preview-${template.id}`}
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <header className="mb-4 flex items-start gap-3 border-b border-slate-200 pb-4">
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white"
        >
          <Mail className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="text-lg font-semibold text-slate-950"
            id={`template-preview-${template.id}`}
          >
            {template.name}
          </h2>
          {template.categoryId && (
            <p className="mt-1 text-sm text-slate-600">Category: {template.categoryId}</p>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-700">Subject</h3>
          <p className="mt-1 rounded-md bg-slate-50 p-3 text-sm text-slate-900 font-mono break-words">
            {template.subject}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700">Body</h3>
          <div className="mt-1 rounded-md bg-slate-50 p-3 text-sm text-slate-900 font-mono whitespace-pre-wrap break-words">
            {template.body}
          </div>
        </div>

        {template.variables.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-700">Variables</h3>
            <dl className="mt-2 space-y-2">
              {template.variables.map((variable) => (
                <div
                  className="flex items-center gap-2 rounded-md bg-slate-50 p-2"
                  key={variable.key}
                >
                  <dt className="font-mono text-sm font-medium text-slate-950">{variable.key}</dt>
                  <dd className="text-sm text-slate-600">— {variable.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

export type { TemplatePreviewProps };
