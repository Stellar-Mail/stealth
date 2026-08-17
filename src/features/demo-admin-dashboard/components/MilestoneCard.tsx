import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone } from "../types/campaignTimeline";
import { getMilestoneToken, getMilestoneStatusToken } from "../constants/displayTokens";

interface MilestoneCardProps {
  milestone: Milestone;
  isOverdue: boolean;
}

function formatLocalDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

export function MilestoneCard({ milestone, isOverdue }: MilestoneCardProps) {
  const kindToken = getMilestoneToken(milestone.kind);
  const effectiveStatus = isOverdue ? "overdue" : milestone.status;
  const statusToken = getMilestoneStatusToken(effectiveStatus);

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-4 space-y-3 transition-colors",
        isOverdue ? "border-rose-500/40 bg-rose-500/5" : "border-white/[0.08]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
              kindToken.bg,
              kindToken.text,
              kindToken.border,
            )}
          >
            {kindToken.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
              statusToken.bg,
              statusToken.text,
              statusToken.border,
            )}
          >
            {statusToken.label}
          </span>
        </div>
        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground leading-snug">{milestone.label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
          Due {formatLocalDate(milestone.dueAt)}
        </p>
        {milestone.resolvedAt && (
          <p className="mt-0.5 text-[11px] text-emerald-400 tabular-nums">
            Resolved {formatLocalDate(milestone.resolvedAt)}
          </p>
        )}
      </div>

      {milestone.note && (
        <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-white/[0.05] pt-2">
          {milestone.note}
        </p>
      )}
    </div>
  );
}
