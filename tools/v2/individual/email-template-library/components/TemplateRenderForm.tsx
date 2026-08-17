import { useState } from "react";
import { Send } from "lucide-react";
import type { EmailTemplate, RenderTemplateResult } from "../types";

interface TemplateRenderFormProps {
  template: EmailTemplate;
  onRender?: (templateId: string, values: Record<string, string>) => void;
  renderResult?: RenderTemplateResult;
}

export function TemplateRenderForm({ template, onRender, renderResult }: TemplateRenderFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    template.variables.reduce(
      (acc, variable) => {
        acc[variable.key] = "";
        return acc;
      },
      {} as Record<string, string>,
    ),
  );

  const handleInputChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (onRender) {
      onRender(template.id, values);
    }
  };

  const allFieldsFilled = template.variables.every((variable) => values[variable.key]?.trim());

  return (
    <section
      aria-labelledby={`render-form-${template.id}`}
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950" id={`render-form-${template.id}`}>
          Render Template
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Fill in the variables below to generate your personalized email.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {template.variables.map((variable) => (
          <div key={variable.key}>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor={`variable-${template.id}-${variable.key}`}
            >
              {variable.label}
              <span className="ml-1 text-slate-500">({variable.key})</span>
            </label>
            <input
              aria-required="true"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-0"
              id={`variable-${template.id}-${variable.key}`}
              onChange={(e) => handleInputChange(variable.key, e.target.value)}
              placeholder={`Enter ${variable.label.toLowerCase()}`}
              required
              type="text"
              value={values[variable.key]}
            />
          </div>
        ))}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allFieldsFilled}
          type="submit"
        >
          <Send aria-hidden="true" className="size-4" />
          Render Template
        </button>
      </form>

      {renderResult && (
        <div aria-live="polite" className="mt-6 space-y-4 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-950">Rendered Output</h3>

          <div>
            <h4 className="text-sm font-medium text-slate-700">Subject</h4>
            <p className="mt-1 rounded-md bg-slate-50 p-3 text-sm text-slate-900 break-words">
              {renderResult.subject}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700">Body</h4>
            <div className="mt-1 rounded-md bg-slate-50 p-3 text-sm text-slate-900 whitespace-pre-wrap break-words">
              {renderResult.body}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export type { TemplateRenderFormProps };
