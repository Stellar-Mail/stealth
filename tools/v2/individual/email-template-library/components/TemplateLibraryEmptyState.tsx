interface TemplateLibraryEmptyStateProps {
  onCreateTemplate?: () => void;
}

export function TemplateLibraryEmptyState({ onCreateTemplate }: TemplateLibraryEmptyStateProps) {
  return (
    <section
      aria-labelledby="template-library-empty-title"
      className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"
    >
      <h2 id="template-library-empty-title" className="text-lg font-semibold text-slate-950">
        No templates yet
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Create a reusable email template before connecting this tool to the main composer.
      </p>
      <button
        type="button"
        onClick={onCreateTemplate}
        className="mt-5 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        aria-label="Create first email template"
      >
        Create template
      </button>
    </section>
  );
}
