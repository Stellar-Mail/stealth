interface PayoutSuccessProps {
  onCreateAnother: () => void;
}

export function PayoutSuccess({ onCreateAnother }: PayoutSuccessProps) {
  return (
    <section aria-labelledby="success-heading" className="rounded-xl border p-8 text-center">
      <div aria-hidden="true" className="mb-4 text-4xl">
        ✓
      </div>

      <h2 id="success-heading" className="text-lg font-semibold">
        Payout request created
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        The request is ready for a future integration with the Stellar payout workflow.
      </p>

      <button type="button" onClick={onCreateAnother} className="mt-6 rounded-md border px-4 py-2">
        Create another request
      </button>
    </section>
  );
}
