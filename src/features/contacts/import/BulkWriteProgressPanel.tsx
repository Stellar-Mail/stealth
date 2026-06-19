import { AlertCircle, CheckCircle2, Loader2, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkWriteProgress, PolicyWriteJob } from "./types";

type Props = {
  progress: BulkWriteProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
};

function StatusIcon({ status }: { status: PolicyWriteJob["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />;
    case "success":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <div className="h-3.5 w-3.5 rounded-full border border-white/20" />;
  }
}

export function BulkWriteProgressPanel({ progress, onPause, onResume, onCancel }: Props) {
  const isRunning = progress.status === "running";
  const isPaused = progress.status === "paused";
  const isCompleted = progress.status === "completed";
  const isFailed = progress.status === "failed";
  const isIdle = progress.status === "idle";
  const pct =
    progress.total > 0
      ? Math.round(((progress.succeeded + progress.failed) / progress.total) * 100)
      : 0;

  if (isIdle) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {isCompleted
            ? "Migration complete"
            : isFailed
              ? "Migration failed"
              : isPaused
                ? "Migration paused"
                : "Migrating contacts"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isCompleted
            ? "All sender rules have been written."
            : isPaused
              ? "You can resume or cancel below."
              : "Writing sender rules to your mailbox policy…"}
        </p>
      </div>

      {/* progress bar */}
      <div className="space-y-1.5">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${(progress.succeeded / Math.max(progress.total, 1)) * 100}%` }}
          />
          <div
            className="h-full rounded-full bg-red-400 transition-all duration-500"
            style={{ width: `${(progress.failed / Math.max(progress.total, 1)) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>
            Batch {progress.currentBatch} / {progress.totalBatches}
          </span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* counts */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <span className="block text-emerald-400 text-sm font-semibold">{progress.succeeded}</span>
          <span className="text-muted-foreground">Allowed</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <span className="block text-red-400 text-sm font-semibold">{progress.failed}</span>
          <span className="text-muted-foreground">Failed</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <span className="block text-muted-foreground text-sm font-semibold">
            {progress.total}
          </span>
          <span className="text-muted-foreground">Total</span>
        </div>
      </div>

      {/* errors */}
      {progress.errors.length > 0 && (
        <div className="max-h-24 overflow-y-auto space-y-1 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-3">
          <p className="text-[11px] font-medium text-red-300">Errors</p>
          {progress.errors.slice(0, 5).map((err, i) => (
            <p key={i} className="text-[10px] text-red-200/70 font-mono">
              {err.sender}: {err.error}
            </p>
          ))}
          {progress.errors.length > 5 && (
            <p className="text-[10px] text-muted-foreground">
              …and {progress.errors.length - 5} more
            </p>
          )}
        </div>
      )}

      {/* actions */}
      <div className="flex gap-3">
        {isRunning && (
          <button
            onClick={onPause}
            className="flex items-center justify-center gap-2 flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
          >
            <PauseCircle className="h-4 w-4" />
            Pause
          </button>
        )}
        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              <PlayCircle className="h-4 w-4" />
              Resume
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 flex-1 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-400/[0.06]"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          </>
        )}
        {(isCompleted || isFailed) && (
          <button
            onClick={onCancel}
            className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
