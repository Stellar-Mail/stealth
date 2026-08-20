import { useState } from "react";
import {
  AlertCircle,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Info,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { StageState } from "@/features/compose/sendPipeline";

export interface FailureInspectionDetails {
  stage?: string;
  code?: string;
  message?: string;
  supportId?: string;
  timestamp?: string;
  isCommitted?: boolean;
  canRetry?: boolean;
}

function getStageColor(status: StageState["status"]) {
  if (status === "error") return "text-red-200";
  if (status === "done") return "text-foreground/90 font-medium";
  if (status === "active") return "text-blue-200 font-medium";
  return "text-muted-foreground";
}

function StageIcon({ status }: Readonly<{ status: StageState["status"] }>) {
  if (status === "done") return <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === "active")
    return <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin text-blue-400 shrink-0" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />;
}

function renderStatusBadge(isSafeRetry: boolean, isCommitted: boolean) {
  if (isSafeRetry) {
    return (
      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300 border border-emerald-500/20">
        Draft safe
      </span>
    );
  }
  if (isCommitted) {
    return (
      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 border border-amber-500/20">
        Committed to relay
      </span>
    );
  }
  return null;
}

export function SendProgress({
  stages,
  error,
  failureDetails,
  supportId,
  canRetry = true,
  isCommitted = false,
  onRetry,
  onSaveDraft,
  onInspectFailure,
}: Readonly<{
  stages: StageState[];
  error: string | null;
  failureDetails?: FailureInspectionDetails | null;
  supportId?: string;
  canRetry?: boolean;
  isCommitted?: boolean;
  onRetry?: () => void;
  onSaveDraft?: () => void;
  onInspectFailure?: () => void;
}>) {
  const [copied, setCopied] = useState(false);
  const [showInspection, setShowInspection] = useState(false);

  const activeSupportId =
    failureDetails?.supportId ?? supportId ?? stages.find((s) => s.status === "error")?.id;

  const handleCopySupportId = async () => {
    if (!activeSupportId) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(activeSupportId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback if clipboard permission is unavailable
    }
  };

  const toggleInspect = () => {
    setShowInspection((prev) => !prev);
    onInspectFailure?.();
  };

  const failedStage = stages.find((s) => s.status === "error");
  const isSafeRetry = !isCommitted && canRetry;

  return (
    <div
      className="mt-2 rounded-xl border border-white/10 bg-white/4 p-3.5 text-xs shadow-lg backdrop-blur-md transition-all"
      aria-live="polite"
      aria-busy={!error && stages.some((s) => s.status === "active")}
    >
      <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Send Pipeline Progress
        </span>
        {activeSupportId && (
          <button
            type="button"
            onClick={handleCopySupportId}
            title="Click to copy Support ID for this send operation"
            aria-label={`Copy support ID ${activeSupportId}`}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-muted-foreground transition hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            {copied ? (
              <>
                <CheckCheck className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>{activeSupportId}</span>
              </>
            )}
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-2.5">
            <StageIcon status={stage.status} />
            <span className={getStageColor(stage.status)}>{stage.label}</span>
            {stage.detail && (
              <span className="ml-auto truncate text-[10px] text-muted-foreground/80 max-w-[200px] text-right font-mono">
                {stage.detail}
              </span>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-3 space-y-2.5 border-t border-red-500/20 pt-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-red-200">{error}</span>
                {renderStatusBadge(isSafeRetry, isCommitted)}
              </div>
              {failedStage?.detail && (
                <p className="mt-0.5 text-[10px] text-red-300/80">{failedStage.detail}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={toggleInspect}
                aria-expanded={showInspection}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-foreground/80 transition hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <Info className="h-3 w-3 text-muted-foreground" />
                <span>{showInspection ? "Hide details" : "Inspect failure"}</span>
                {showInspection ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {onSaveDraft && (
                <button
                  type="button"
                  onClick={onSaveDraft}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-foreground/80 transition hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                >
                  <Bookmark className="h-3 w-3 text-muted-foreground" />
                  <span>Save draft</span>
                </button>
              )}
            </div>

            {isSafeRetry && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md border border-blue-400/30 bg-blue-500/20 px-2.5 py-1 text-[11px] font-medium text-blue-100 transition hover:bg-blue-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <RotateCcw className="h-3 w-3 text-blue-300" />
                <span>Retry send</span>
              </button>
            )}
          </div>

          {showInspection && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10px] font-mono text-muted-foreground animate-in fade-in duration-200">
              <div className="flex justify-between">
                <span className="text-foreground/70">Failed Stage:</span>
                <span className="text-red-300">{failedStage?.id ?? "unknown"}</span>
              </div>
              {failureDetails?.code && (
                <div className="flex justify-between">
                  <span className="text-foreground/70">Error Code:</span>
                  <span className="text-foreground/90">{failureDetails.code}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-foreground/70">State:</span>
                <span>{isCommitted ? "Committed (deduplicated)" : "Uncommitted (safe retry)"}</span>
              </div>
              {activeSupportId && (
                <div className="flex justify-between items-center">
                  <span className="text-foreground/70">Support Reference:</span>
                  <span className="text-foreground/90">{activeSupportId}</span>
                </div>
              )}
              {failureDetails?.timestamp && (
                <div className="flex justify-between">
                  <span className="text-foreground/70">Timestamp:</span>
                  <span>{failureDetails.timestamp}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
