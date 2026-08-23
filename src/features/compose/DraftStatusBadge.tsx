import { Check, Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftSaveStatus } from "./useDraftAutosave";

interface DraftStatusBadgeProps {
  status: DraftSaveStatus;
  version?: number;
  lastSavedAt?: Date | null;
  className?: string;
}

export function DraftStatusBadge({
  status,
  version,
  lastSavedAt,
  className,
}: DraftStatusBadgeProps) {
  if (status === "idle" && !lastSavedAt) {
    return null;
  }

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border",
        status === "saving" && "bg-sky-500/10 text-sky-400 border-sky-500/20",
        status === "saved" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        status === "conflict" && "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
        status === "error" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
        status === "idle" && "bg-neutral-800 text-neutral-400 border-neutral-700",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
          <span>Saving...</span>
        </>
      )}

      {status === "saved" && (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Saved {lastSavedAt ? formatTime(lastSavedAt) : ""}
            {version ? ` (rev ${version})` : ""}
          </span>
        </>
      )}

      {status === "conflict" && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Edit conflict</span>
        </>
      )}

      {status === "error" && (
        <>
          <CloudOff className="w-3.5 h-3.5 text-rose-400" />
          <span>Offline — draft safe</span>
        </>
      )}

      {status === "idle" && lastSavedAt && (
        <>
          <Cloud className="w-3.5 h-3.5 text-neutral-400" />
          <span>Saved {formatTime(lastSavedAt)}</span>
        </>
      )}
    </div>
  );
}
