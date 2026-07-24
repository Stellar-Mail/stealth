interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <section aria-labelledby="empty-title" className="rounded-xl border p-8 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border"
      >
        💸
      </div>

      <h2 id="empty-title" className="text-lg font-semibold">
        No payout requests
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        Create a Stellar team payout request to begin managing payouts.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-6 rounded-md border px-4 py-2"
        aria-label="Create payout request"
      >
        Create payout request
      </button>
    </section>
  );
}
