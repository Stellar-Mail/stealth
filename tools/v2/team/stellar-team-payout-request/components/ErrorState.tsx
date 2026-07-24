interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section role="alert" className="rounded-xl border border-destructive p-6">
      <h2 className="text-lg font-semibold">Unable to load payout request</h2>

      <p className="mt-2 text-sm">{message}</p>

      <button type="button" onClick={onRetry} className="mt-4 rounded-md border px-4 py-2">
        Retry
      </button>
    </section>
  );
}
