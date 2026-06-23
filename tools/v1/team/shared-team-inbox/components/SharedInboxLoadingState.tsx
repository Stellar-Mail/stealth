export function SharedInboxLoadingState() {
  return (
    <section
      aria-labelledby="shared-inbox-loading-title"
      aria-live="polite"
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <h2 id="shared-inbox-loading-title" className="text-base font-semibold text-slate-950">
        Loading shared inbox
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Checking the shared message feed, assignments, and internal comments.
      </p>
      <div className="mt-5 space-y-3" aria-hidden="true">
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
        <div className="h-20 rounded bg-slate-100" />
      </div>
    </section>
  );
}
