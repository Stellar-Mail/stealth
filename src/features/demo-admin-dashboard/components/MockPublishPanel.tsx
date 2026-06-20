import { RotateCcw, RotateCw, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockPublishState } from "../mockPublishWorkflow";
import {
  canRetryMockPublish,
  canRollbackMockPublish,
  canStartMockPublish,
  getMockPublishSummary,
} from "../mockPublishWorkflow";

export interface MockPublishPanelProps {
  state: MockPublishState;
  onStart: () => void;
  onRetry: () => void;
  onRollback: () => void;
  className?: string;
}

export function MockPublishPanel({
  state,
  onStart,
  onRetry,
  onRollback,
  className,
}: MockPublishPanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Mock publish workflow</h3>
        </div>
        <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-muted-foreground">
          {state.status}
        </span>
      </header>

      <p className="text-sm text-muted-foreground">{getMockPublishSummary(state)}</p>

      <ol className="flex flex-col gap-2">
        {state.steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                step.complete ? "border-emerald-400 bg-emerald-400" : "border-white/20",
              )}
            />
            <span className={step.complete ? "text-foreground" : "text-muted-foreground"}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {state.error ? (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canStartMockPublish(state)}
          onClick={onStart}
          className={actionButtonClass(canStartMockPublish(state))}
        >
          <Send className="h-4 w-4" />
          Start
        </button>
        <button
          type="button"
          disabled={!canRetryMockPublish(state)}
          onClick={onRetry}
          className={actionButtonClass(canRetryMockPublish(state))}
        >
          <RotateCw className="h-4 w-4" />
          Retry
        </button>
        <button
          type="button"
          disabled={!canRollbackMockPublish(state)}
          onClick={onRollback}
          className={actionButtonClass(canRollbackMockPublish(state))}
        >
          <RotateCcw className="h-4 w-4" />
          Roll back
        </button>
      </div>
    </section>
  );
}

function actionButtonClass(enabled: boolean): string {
  return cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors",
    enabled
      ? "border-white/[0.08] text-foreground hover:bg-white/[0.04]"
      : "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60",
  );
}
