import type {
  EmailTemplateListItem,
  TemplateLibraryActionHandlers,
  TemplateLibraryStats,
  TemplatePreviewResult,
} from "../types";
import { TemplateCard } from "./TemplateCard";
import { TemplateLibraryEmptyState } from "./TemplateLibraryEmptyState";
import { TemplateLibraryErrorState } from "./TemplateLibraryErrorState";
import { TemplateLibraryLoadingState } from "./TemplateLibraryLoadingState";
import { TemplateLibraryStats as TemplateLibraryStatsView } from "./TemplateLibraryStats";
import { TemplateLibrarySuccessState } from "./TemplateLibrarySuccessState";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";

interface EmailTemplateLibraryProps extends TemplateLibraryActionHandlers {
  templates: EmailTemplateListItem[];
  stats: TemplateLibraryStats;
  preview: TemplatePreviewResult;
  selectedTemplateId?: string | null;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  onDismissSuccess?: () => void;
}

export function EmailTemplateLibrary({
  templates,
  stats,
  preview,
  selectedTemplateId = null,
  isLoading = false,
  error = null,
  successMessage = null,
  onDismissSuccess,
  onCreateTemplate,
  onRetry,
  onSelectTemplate,
  onCopyTemplate,
  onEditTemplate,
}: EmailTemplateLibraryProps) {
  if (isLoading) {
    return <TemplateLibraryLoadingState />;
  }

  if (error) {
    return <TemplateLibraryErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6" aria-labelledby="email-template-library-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Individual workflow
          </p>
          <h1 id="email-template-library-title" className="text-2xl font-semibold text-slate-950">
            Email Template Library
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Organize reusable email templates, preview variable output, and copy draft-ready text
            without mounting this V2 tool in the main composer.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateTemplate}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label="Create new email template"
        >
          New template
        </button>
      </header>

      {successMessage ? (
        <TemplateLibrarySuccessState message={successMessage} onDismiss={onDismissSuccess} />
      ) : null}

      <TemplateLibraryStatsView stats={stats} />

      {templates.length === 0 ? (
        <TemplateLibraryEmptyState onCreateTemplate={onCreateTemplate} />
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4" role="list" aria-label="Email templates">
            {templates.map((template) => (
              <div role="listitem" key={template.id}>
                <TemplateCard
                  template={template}
                  selected={template.id === selectedTemplateId}
                  onSelectTemplate={onSelectTemplate}
                  onCopyTemplate={onCopyTemplate}
                  onEditTemplate={onEditTemplate}
                />
              </div>
            ))}
          </div>
          <TemplatePreviewPanel result={preview} />
        </section>
      )}
    </main>
  );
}
