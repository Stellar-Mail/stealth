import React from "react";

export function EmptyState() {
  return (
    <section
      aria-labelledby="empty-title"
      className="rounded-xl border bg-card px-6 py-16 text-center"
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--gradient-glass)]"
      >
        📋
      </div>

      <h2 id="empty-title" className="text-lg font-semibold">
        No workload assignments
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        Create your first workload distribution to begin balancing assignments across your team.
      </p>

      <button
        type="button"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Create Assignment
      </button>
    </section>
  );
}
