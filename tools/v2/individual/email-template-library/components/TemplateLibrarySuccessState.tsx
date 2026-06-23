interface TemplateLibrarySuccessStateProps {
  message: string;
  onDismiss?: () => void;
}

export function TemplateLibrarySuccessState({ message, onDismiss }: TemplateLibrarySuccessStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby="template-library-success-title"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="template-library-success-title" className="text-sm font-semibold">
            Template library updated
          </h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-sm font-medium text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            aria-label="Dismiss template library update"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </section>
  );
}
