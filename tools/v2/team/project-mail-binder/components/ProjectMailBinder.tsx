import * as React from "react";
import type { BinderState } from "../types";
import { A11Y } from "../types";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { ProjectList } from "./ProjectList";
import { ProjectDetail } from "./ProjectDetail";

/**
 * ProjectMailBinder — container/screen component for the mail binder workflow.
 *
 * Manages a `BinderState` and renders the appropriate sub-view.
 * Wraps content in an aria-live region so async state transitions
 * (loading → success/error) are announced to screen readers.
 *
 * This component is self-contained and driven entirely by local state +
 * fixture data. It has no external dependencies and is not wired into
 * the main application routing or shell.
 */
export function ProjectMailBinder({ initialState }: { initialState: BinderState }) {
  const [state, setState] = React.useState<BinderState>(initialState);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);

  // Sync if initialState prop changes (useful for testing/storybook)
  React.useEffect(() => {
    setState(initialState);
    setSelectedProjectId(null);
  }, [initialState]);

  const handleRetry = React.useCallback(() => {
    // In a real implementation, this would re-fetch data.
    // For the scaffold, we reset to loading then restore the initial state.
    setState({ status: "loading" });
    const timer = setTimeout(() => setState(initialState), 800);
    return () => clearTimeout(timer);
  }, [initialState]);

  const handleCreate = React.useCallback(() => {
    // Placeholder — no-op in the scaffold.
    // A real implementation would open a create-binder dialog.
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === A11Y.keys.ESCAPE && selectedProjectId !== null) {
        e.preventDefault();
        setSelectedProjectId(null);
      }
    },
    [selectedProjectId],
  );

  // Derive detail data when a project is selected
  const selectedProject =
    state.status === "success"
      ? (state.projects.find((p) => p.id === selectedProjectId) ?? null)
      : null;

  const selectedMails =
    state.status === "success" && selectedProjectId
      ? state.mails.filter((m) => m.projectId === selectedProjectId)
      : [];

  return (
    <section
      aria-label={A11Y.containerLabel}
      onKeyDown={handleKeyDown}
      className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-xl"
      style={{
        backgroundColor: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-elegant)",
      }}
      id="binder-container"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          {A11Y.containerLabel}
        </h1>
        {state.status === "success" && !selectedProject && (
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {state.projects.length} {state.projects.length === 1 ? "project" : "projects"}
          </span>
        )}
      </header>

      {/* Content — wrapped in aria-live for async announcements */}
      <div aria-live={A11Y.liveRegion} className="min-h-[280px]">
        {state.status === "empty" && <EmptyState onCreateClick={handleCreate} />}

        {state.status === "loading" && <LoadingState />}

        {state.status === "error" && <ErrorState message={state.message} onRetry={handleRetry} />}

        {state.status === "success" && !selectedProject && (
          <ProjectList
            projects={state.projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />
        )}

        {state.status === "success" && selectedProject && (
          <ProjectDetail
            project={selectedProject}
            mails={selectedMails}
            onClose={() => setSelectedProjectId(null)}
          />
        )}
      </div>
    </section>
  );
}
