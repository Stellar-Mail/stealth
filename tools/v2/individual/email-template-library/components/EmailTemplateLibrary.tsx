import * as React from "react";

import {
  emailTemplateCategoryLabels,
  emailTemplateFixtures,
  type EmailTemplate,
  type EmailTemplateCategory,
} from "../fixtures/templates";

type EmailTemplateLibraryProps = {
  templates?: EmailTemplate[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onTemplateSelect?: (templateId: string) => void;
  onUseTemplate?: (template: EmailTemplate) => void;
};

const categoryOptions: Array<EmailTemplateCategory | "all"> = [
  "all",
  "follow-up",
  "intro",
  "billing",
  "support",
];

export function EmailTemplateLibrary({
  templates = emailTemplateFixtures,
  isLoading = false,
  error = null,
  onRetry,
  onTemplateSelect,
  onUseTemplate,
}: EmailTemplateLibraryProps) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<EmailTemplateCategory | "all">("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(templates[0]?.id ?? null);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const searchId = React.useId();
  const categoryHeadingId = React.useId();
  const statusId = React.useId();

  React.useEffect(() => {
    if (templates.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !templates.some((template) => template.id === selectedId)) {
      setSelectedId(templates[0].id);
    }
  }, [selectedId, templates]);

  const filteredTemplates = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesCategory = category === "all" || template.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [template.name, template.subject, template.body, ...template.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, query, templates]);

  const selectedTemplate =
    filteredTemplates.find((template) => template.id === selectedId) ??
    filteredTemplates[0] ??
    null;

  function selectTemplate(template: EmailTemplate) {
    setSelectedId(template.id);
    setSuccessMessage("");
    setStatusMessage(`${template.name} selected`);
    onTemplateSelect?.(template.id);
  }

  function useSelectedTemplate() {
    if (!selectedTemplate) {
      return;
    }

    setStatusMessage(`${selectedTemplate.name} is ready to use`);
    setSuccessMessage(`${selectedTemplate.name} is ready to insert into a draft.`);
    onUseTemplate?.(selectedTemplate);
  }

  return (
    <section
      aria-busy={isLoading}
      aria-describedby={statusId}
      className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-normal text-indigo-700">
            Email Template Library
          </p>
          <h2 className="text-xl font-semibold tracking-normal">Reusable personal replies</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Search, preview, and select local email templates without connecting this V2 tool to the
            production mail app.
          </p>
        </div>

        <div className="w-full md:max-w-sm">
          <label htmlFor={searchId} className="mb-1 block text-sm font-medium text-slate-800">
            Search templates
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by subject, tag, or body"
            onInput={() => setSuccessMessage("")}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : isLoading ? (
        <LoadingState />
      ) : templates.length === 0 || filteredTemplates.length === 0 ? (
        <EmptyState
          hasFilters={templates.length > 0}
          onClearFilters={() => {
            setQuery("");
            setCategory("all");
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <nav aria-labelledby={categoryHeadingId} className="grid content-start gap-3">
            <h3 id={categoryHeadingId} className="text-sm font-semibold text-slate-800">
              Categories
            </h3>
            <div className="grid gap-2" aria-label="Template categories">
              {categoryOptions.map((option) => {
                const isSelected = category === option;
                const label =
                  option === "all" ? "All templates" : emailTemplateCategoryLabels[option];

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setCategory(option);
                      setSuccessMessage("");
                    }}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_1fr]">
            <div className="grid content-start gap-2" aria-label="Email templates">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplate?.id === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-current={isSelected}
                    onClick={() => selectTemplate(template)}
                    className={`rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-950">
                      {template.name}
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">{template.subject}</span>
                    <span className="mt-3 flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedTemplate ? (
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                      Preview
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">
                      {selectedTemplate.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={useSelectedTemplate}
                    className="h-9 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    Use template
                  </button>
                </div>

                <dl className="mt-4 grid gap-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                      Subject
                    </dt>
                    <dd className="mt-1 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900">
                      {selectedTemplate.subject}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                      Body
                    </dt>
                    <dd className="mt-1 whitespace-pre-line rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900">
                      {selectedTemplate.body}
                    </dd>
                  </div>
                  <div className="text-xs text-slate-500">
                    Last updated{" "}
                    <time dateTime={selectedTemplate.lastUpdated}>
                      {selectedTemplate.lastUpdated}
                    </time>
                  </div>
                </dl>
              </article>
            ) : null}
          </div>
        </div>
      )}

      {successMessage && !isLoading && !error ? (
        <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">{successMessage}</p>
        </div>
      ) : null}

      <p id={statusId} aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading templates">
      <span className="sr-only">Loading templates</span>
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
      <p className="font-semibold text-red-900">Templates could not be loaded.</p>
      <p className="mt-1 text-red-800">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-9 rounded-md bg-red-700 px-3 text-sm font-medium text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div role="status" className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm">
      <p className="font-semibold text-slate-950">
        {hasFilters ? "No templates match the current filters." : "No templates yet."}
      </p>
      <p className="mt-1 text-slate-600">
        {hasFilters
          ? "Clear filters or search for a different subject, tag, or template body."
          : "Add a local fixture or connect a future template service inside this tool folder."}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-3 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
