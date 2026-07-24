export function LoadingState() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="loading-title"
      className="space-y-4 rounded-xl border p-6"
    >
      <span className="sr-only">Loading payout request interface.</span>

      <h2 id="loading-title" className="sr-only">
        Loading
      </h2>

      <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
    </section>
  );
}
