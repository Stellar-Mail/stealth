import { useMemo, useState } from "react";
import { Filter, Mail } from "lucide-react";
import type { EmailTemplate, RenderTemplateResult } from "../types";
import { EmailTemplateLibraryEmptyState } from "./EmailTemplateLibraryEmptyState";
import { EmailTemplateLibraryErrorState } from "./EmailTemplateLibraryErrorState";
import { EmailTemplateLibraryLoadingState } from "./EmailTemplateLibraryLoadingState";
import { TemplateCard } from "./TemplateCard";
import { TemplatePreview } from "./TemplatePreview";
import { TemplateRenderForm } from "./TemplateRenderForm";

type ViewState = "loading" | "error" | "ready";
type ViewMode = "list" | "preview" | "render";

interface EmailTemplateLibraryToolProps {
  templates?: EmailTemplate[];
  errorMessage?: string;
  initialState?: ViewState;
  onRenderTemplate?: (templateId: string, values: Record<string, string>) => void;
  renderResult?: RenderTemplateResult;
}

export function EmailTemplateLibraryTool({
  templates = [],
  errorMessage,
  initialState = "ready",
  onRenderTemplate,
  renderResult,
}: EmailTemplateLibraryToolProps) {
  const [viewState, setViewState] = useState<ViewState>(initialState);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      templates.map((template) => template.categoryId).filter((id): id is string => id !== null),
    );
    return Array.from(uniqueCategories).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === null) return templates;
    return templates.filter((template) => template.categoryId === categoryFilter);
  }, [templates, categoryFilter]);

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setViewMode("preview");
  };

  const handleStartRender = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setViewMode("render");
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedTemplate(null);
  };

  if (viewState === "loading") {
    return <EmailTemplateLibraryLoadingState message="Loading template library..." />;
  }

  if (viewState === "error") {
    return (
      <EmailTemplateLibraryErrorState
        details={errorMessage}
        onRetry={() => setViewState("ready")}
      />
    );
  }

  return (
    <section
      aria-labelledby="email-template-library-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Individual V2 tool
          </p>
          <h1
            className="mt-1 text-2xl font-semibold text-slate-950"
            id="email-template-library-title"
          >
            Email Template Library
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Browse, preview, and render personalized email templates with variable substitution.
          </p>
        </div>

        {viewMode !== "list" && (
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            onClick={handleBackToList}
            type="button"
          >
            ← Back to Templates
          </button>
        )}
      </header>

      {viewMode === "list" && (
        <>
          {categories.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter aria-hidden="true" className="size-4" />
                Filter by category
              </div>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Template category filter</legend>
                <label
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    categoryFilter === null
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    checked={categoryFilter === null}
                    className="sr-only"
                    name="category-filter"
                    onChange={() => setCategoryFilter(null)}
                    type="radio"
                    value="all"
                  />
                  All
                </label>
                {categories.map((category) => (
                  <label
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      categoryFilter === category
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    key={category}
                  >
                    <input
                      checked={categoryFilter === category}
                      className="sr-only"
                      name="category-filter"
                      onChange={() => setCategoryFilter(category)}
                      type="radio"
                      value={category}
                    />
                    {category}
                  </label>
                ))}
              </fieldset>
            </div>
          )}

          {filteredTemplates.length > 0 ? (
            <div aria-label="Available email templates" className="space-y-3" role="list">
              {filteredTemplates.map((template) => (
                <div key={template.id} role="listitem">
                  <TemplateCard onSelect={handleTemplateSelect} template={template} />
                </div>
              ))}
            </div>
          ) : (
            <EmailTemplateLibraryEmptyState
              action={
                categoryFilter !== null ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                    onClick={() => setCategoryFilter(null)}
                    type="button"
                  >
                    <Filter aria-hidden="true" className="size-4" />
                    Clear filter
                  </button>
                ) : null
              }
              description={
                templates.length === 0
                  ? "No templates are available in the library. Add templates to get started."
                  : "No templates match the current filter. Choose another category or clear the filter."
              }
              title={templates.length === 0 ? "No templates available" : "No matching templates"}
            />
          )}
        </>
      )}

      {viewMode === "preview" && selectedTemplate && (
        <div className="space-y-4">
          <TemplatePreview template={selectedTemplate} />
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            onClick={() => handleStartRender(selectedTemplate)}
            type="button"
          >
            <Mail aria-hidden="true" className="size-4" />
            Use this template
          </button>
        </div>
      )}

      {viewMode === "render" && selectedTemplate && (
        <TemplateRenderForm
          onRender={onRenderTemplate}
          renderResult={renderResult}
          template={selectedTemplate}
        />
      )}
    </section>
  );
}

export type { EmailTemplateLibraryToolProps };
