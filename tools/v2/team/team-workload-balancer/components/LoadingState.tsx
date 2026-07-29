import React from "react";

export function LoadingState() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading workload data…</span>

      {[1, 2, 3].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-lg border bg-card" />
      ))}
    </section>
  );
}
