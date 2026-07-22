import React from "react";
import { useMeetingAssignments } from "../hooks/useMeetingAssignments";
import { AssignmentList } from "./AssignmentList";
import { AssignmentSummaryCard } from "./AssignmentSummaryCard";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

export const MeetingAssignmentPanel: React.FC = () => {
  const { state, reload } = useMeetingAssignments();

  return (
    <section
      aria-labelledby="meeting-assignment-heading"
      className="mx-auto flex max-w-2xl flex-col gap-4 p-4"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 id="meeting-assignment-heading" className="text-lg font-semibold text-gray-900">
            Meeting Assignment
          </h2>
          <p className="text-sm text-gray-500">
            Assign meetings to team members based on skills, workload, and capacity.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={state.status === "loading"}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reassign
        </button>
      </header>

      {state.status === "loading" && <LoadingState />}

      {state.status === "error" && <ErrorState message={state.message} onRetry={reload} />}

      {state.status === "success" && state.data.assignments.length === 0 && <EmptyState />}

      {state.status === "success" && state.data.assignments.length > 0 && (
        <div className="flex flex-col gap-4">
          <AssignmentSummaryCard summary={state.data.summary} />
          <AssignmentList assignments={state.data.assignments} />
        </div>
      )}
    </section>
  );
};
