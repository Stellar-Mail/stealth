import { AlertCircle, Check, Circle, Loader2 } from "lucide-react";
import type { StageState } from "@/features/compose/sendPipeline";

function StageIcon({ status }: { status: StageState["status"] }) {
  if (status === "done") return <Check className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-300" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
}

export function SendProgress({
  stages,
  error,
  onRetry,
}: {
  stages: StageState[];
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
      <ul className="space-y-1.5">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-2">
            <StageIcon status={stage.status} />
            <span
              className={
                stage.status === "error"
                  ? "text-red-200"
                  : stage.status === "done"
                    ? "text-foreground/80"
                    : "text-muted-foreground"
              }
            >
              {stage.label}
            </span>
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
            className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-foreground/90 transition hover:bg-white/[0.1]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
