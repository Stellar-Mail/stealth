import { AlertCircle, Check, Circle, Loader2 } from "lucide-react";
import type { StageState } from "@/features/compose/sendPipeline";

function getStageColor(status: StageState["status"]) {
  if (status === "error") return "text-red-200";
  if (status === "done") return "text-foreground/80";
  return "text-muted-foreground";
}

function StageIcon({ status }: Readonly<{ status: StageState["status"] }>) {
  if (status === "done") return <Check className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === "active")
    return <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin text-blue-300" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-300" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
}

export function SendProgress({
  stages,
  error,
  onRetry,
}: Readonly<{
  stages: StageState[];
  error: string | null;
  onRetry: () => void;
}>) {
  return (
    <div
      className="mt-2 rounded-lg border border-white/10 bg-white/3 p-3 text-xs"
      aria-live="polite"
      aria-busy={!error && stages.some((s) => s.status === "active")}
    >
      <ul className="space-y-1.5">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-2">
            <StageIcon status={stage.status} />
            <span className={getStageColor(stage.status)}>{stage.label}</span>
            {stage.detail && (
              <span className="ml-auto text-[10px] text-muted-foreground">{stage.detail}</span>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span className="text-red-200">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-foreground/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
