import { Progress } from "@/components/ui/progress";
import type {
  ImportLoadingState,
  ValidationLoadingState,
  PreviewLoadingState,
  PublishLoadingState,
} from "./types";
import { ImportSkeleton, ValidationSkeleton, PreviewSkeleton, PublishSkeleton } from "./skeletons";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatusLabel({ label, error }: { label?: string; error?: string }) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (label) return <p className="text-sm text-muted-foreground">{label}</p>;
  return null;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export function ImportLoadingView({ state }: { state: ImportLoadingState }) {
  if (state.status !== "loading") return null;

  const pct =
    state.progress ??
    (state.totalRecords && state.processedRecords != null
      ? Math.round((state.processedRecords / state.totalRecords) * 100)
      : undefined);

  return (
    <div className="space-y-3">
      <ImportSkeleton />
      {pct != null && <Progress value={pct} />}
      <StatusLabel
        label={
          state.label ??
          (state.processedRecords != null && state.totalRecords != null
            ? `Importing ${state.processedRecords} / ${state.totalRecords} records…`
            : "Preparing import…")
        }
        error={state.error}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function ValidationLoadingView({ state }: { state: ValidationLoadingState }) {
  if (state.status !== "loading") return null;

  const pct =
    state.progress ??
    (state.totalRecords && (state.passCount ?? 0) + (state.failCount ?? 0) > 0
      ? Math.round((((state.passCount ?? 0) + (state.failCount ?? 0)) / state.totalRecords) * 100)
      : undefined);

  return (
    <div className="space-y-3">
      <ValidationSkeleton />
      {pct != null && <Progress value={pct} />}
      <StatusLabel label={state.label ?? "Validating records…"} error={state.error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<NonNullable<PreviewLoadingState["section"]>, string> = {
  inbox: "Rendering inbox preview…",
  thread: "Rendering thread preview…",
  calendar: "Rendering calendar preview…",
  contacts: "Rendering contacts preview…",
};

export function PreviewLoadingView({ state }: { state: PreviewLoadingState }) {
  if (state.status !== "loading") return null;

  return (
    <div className="space-y-3">
      <PreviewSkeleton />
      {state.progress != null && <Progress value={state.progress} />}
      <StatusLabel
        label={state.label ?? (state.section ? SECTION_LABELS[state.section] : "Loading preview…")}
        error={state.error}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish (mock — no real Stellar tx)
// ---------------------------------------------------------------------------

export function PublishLoadingView({ state }: { state: PublishLoadingState }) {
  if (state.status !== "loading") return null;

  return (
    <div className="space-y-3">
      <PublishSkeleton />
      {state.progress != null && <Progress value={state.progress} />}
      <StatusLabel label={state.label ?? "Publishing demo data…"} error={state.error} />
      {state.mockTxId && (
        <p className="font-mono text-xs text-muted-foreground">mock tx: {state.mockTxId}</p>
      )}
    </div>
  );
}
