interface SharedInboxErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function SharedInboxErrorState({ message, onRetry }: SharedInboxErrorStateProps) {
  return (
    <section
      role="alert"
      aria-labelledby="shared-inbox-error-title"
      className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-950"
    >
      <h2 id="shared-inbox-error-title" className="text-base font-semibold">
        Shared inbox could not load
      </h2>
      <p className="mt-2 text-sm">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          aria-label="Retry loading shared team inbox"
        >
          Retry
        </button>
      ) : null}
    </section>
  );
}
