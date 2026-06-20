import { cn } from "@/lib/utils";
import type { CampaignKpiDefinition } from "../types/campaignKpi";
import { computeKpiProgress, formatKpiTrend } from "../utils/campaignKpiHelpers";
import { getKpiMetricToken, getKpiStatusToken, getKpiTrendToken } from "../constants/displayTokens";

interface CampaignAnalyticsCardProps {
  kpi: CampaignKpiDefinition;
}

export function CampaignAnalyticsCard({ kpi }: CampaignAnalyticsCardProps) {
  const metricToken = getKpiMetricToken(kpi.metric);
  const statusToken = getKpiStatusToken(kpi.status);
  const trendToken = getKpiTrendToken(kpi.trend);
  const progress = computeKpiProgress(kpi);
  const progressPct = Math.round(progress * 100);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
      {/* Header: metric kind badge + status badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
            metricToken.bg,
            metricToken.text,
            metricToken.border,
          )}
        >
          {metricToken.label}
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

      {/* Metric label + value */}
      <div>
        <p className="text-sm font-semibold text-foreground leading-snug">{kpi.label}</p>
        <p className="mt-1 tabular-nums text-xl font-bold text-foreground">
          {kpi.currentValue.toLocaleString()}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            / {kpi.target.toLocaleString()}
          </span>
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden"
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${kpi.label} progress: ${progressPct}%`}
      >
        <div
          className={cn("h-full rounded-full transition-all", statusToken.bg)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Footer: trend + window label */}
      <div className="flex items-center gap-2 pt-0.5">
        <span className={cn("text-[11px] font-medium tabular-nums", trendToken.text)}>
          {formatKpiTrend(kpi.trend)}
        </span>
        <span className="text-[11px] text-muted-foreground/60">·</span>
        <span className="text-[11px] text-muted-foreground">{kpi.windowLabel}</span>
      </div>
    </div>
  );
}
