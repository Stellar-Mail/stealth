interface SharedInboxSuccessStateProps {
  message: string;
  onDismiss?: () => void;
}

export function SharedInboxSuccessState({ message, onDismiss }: SharedInboxSuccessStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby="shared-inbox-success-title"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="shared-inbox-success-title" className="text-sm font-semibold">
            Shared inbox updated
          </h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-sm font-medium text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            aria-label="Dismiss shared inbox update"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </section>
  );
}
