import React from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { WorkloadList } from "./WorkloadList";
import { WorkloadSummary } from "./WorkloadSummary";
import { useWorkloadBalancer } from "../hooks/use-workload-balancer";

export function TeamWorkloadBalancer() {
  const { state, members, selectedId, selectMember, retry } = useWorkloadBalancer();

  if (state === "loading") {
    return <LoadingState />;
  }

  if (state === "error") {
    return <ErrorState message="Unable to load workload information." onRetry={retry} />;
  }

  if (members.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold">Team Workload Balancer</h1>
      </header>

      <WorkloadSummary
        totalMembers={members.length}
        totalTasks={members.reduce((sum, member) => sum + member.workload, 0)}
      />

      <WorkloadList members={members} selectedId={selectedId} onSelect={selectMember} />
    </section>
  );
}
