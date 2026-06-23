import type { TemplatePreviewResult } from "../types";

interface TemplatePreviewPanelProps {
  result: TemplatePreviewResult;
}

export function TemplatePreviewPanel({ result }: TemplatePreviewPanelProps) {
  return (
    <aside
      aria-labelledby="email-template-preview-title"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="email-template-preview-title" className="text-base font-semibold text-slate-950">
        Preview
      </h2>
      {result.missingVariables.length > 0 ? (
        <p className="mt-2 text-sm text-amber-800" role="status">
          Missing values: {result.missingVariables.join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-sm text-emerald-800" role="status">
          All variables have preview values.
        </p>
      )}
      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Subject</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">{result.subject}</p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Body</p>
        <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{result.body}</p>
      </div>
    </aside>
  );
}
