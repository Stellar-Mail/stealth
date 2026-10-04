import { Mail } from "lucide-react";
import type { EmailTemplate } from "../types";

interface TemplatePreviewProps {
  template: EmailTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  return (
    <section
      aria-labelledby={`template-preview-${template.id}`}
      className="rounded-lg border border-border bg-card p-6"
    >
      <header className="mb-4 flex items-start gap-3 border-b border-border pb-4">
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
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
            <p className="mt-1 text-sm text-muted-foreground">Category: {template.categoryId}</p>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Subject</h3>
          <p className="mt-1 rounded-md bg-muted p-3 text-sm text-foreground font-mono break-words">
            {template.subject}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground">Body</h3>
          <div className="mt-1 rounded-md bg-muted p-3 text-sm text-foreground font-mono whitespace-pre-wrap break-words">
            {template.body}
          </div>
        </div>

        {template.variables.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">Variables</h3>
            <dl className="mt-2 space-y-2">
              {template.variables.map((variable) => (
                <div className="flex items-center gap-2 rounded-md bg-muted p-2" key={variable.key}>
                  <dt className="font-mono text-sm font-medium text-slate-950">{variable.key}</dt>
                  <dd className="text-sm text-muted-foreground">— {variable.label}</dd>
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
