import React from "react";

interface WorkloadSummaryProps {
  totalMembers: number;
  totalTasks: number;
}

export function WorkloadSummary({ totalMembers, totalTasks }: WorkloadSummaryProps) {
  return (
    <section aria-labelledby="summary-title" className="rounded-lg border bg-card p-4">
      <h2 id="summary-title" className="text-base font-semibold">
        Workload Summary
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Team Members</dt>
          <dd className="text-lg font-semibold">{totalMembers}</dd>
        </div>

        <div>
          <dt className="text-xs text-muted-foreground">Assigned Tasks</dt>
          <dd className="text-lg font-semibold">{totalTasks}</dd>
        </div>
      </dl>
    </section>
  );
}
