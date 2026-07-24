import { useState } from "react";
import { cn } from "@/lib/utils";
import { CAMPAIGN_KPI_DEFINITIONS } from "../fixtures/campaignKpiFixtures";
import { getKpisForCampaign, sortKpisByMetric } from "../utils/campaignKpiHelpers";
import { AdminEmptyState } from "./AdminEmptyState";
import { CampaignAnalyticsCard } from "./CampaignAnalyticsCard";
import type { KpiStatus } from "../types/campaignKpi";

const CAMPAIGN_OPTIONS = [
  {
    id: "campaign-onboarding-2026",
    label: "Onboarding 2026",
    description: "Campaign total · 6 metrics",
  },
  {
    id: "campaign-stellar-launch-2026",
    label: "Stellar Launch 2026",
    description: "Last 7 days · 6 metrics",
  },
];

const STATUS_SUMMARY_TOKENS: Record<
  "met" | "at-risk" | "missed",
  { bg: string; text: string; border: string; label: string }
> = {
  met: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    label: "Met",
  },
  "at-risk": {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "At Risk",
  },
  missed: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    label: "Missed",
  },
};

function countByStatus(statuses: KpiStatus[], status: KpiStatus): number {
  return statuses.filter((s) => s === status).length;
}

export function CampaignAnalyticsPanel() {
  const [selectedId, setSelectedId] = useState<string>(CAMPAIGN_OPTIONS[0].id);

  const allKpis = getKpisForCampaign(CAMPAIGN_KPI_DEFINITIONS, selectedId);
  const kpis = sortKpisByMetric(allKpis);
  const statuses = kpis.map((k) => k.status);

  const metCount = countByStatus(statuses, "met");
  const atRiskCount = countByStatus(statuses, "at-risk");
  const missedCount = countByStatus(statuses, "missed");

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Deterministic demo KPI cards for campaign performance. All values are fake and safe for
        public review.
      </p>

      {/* Campaign picker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CAMPAIGN_OPTIONS.map((opt) => {
          const active = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedId(opt.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                active
                  ? "border-teal-500/50 bg-teal-500/5 ring-1 ring-teal-500/20"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]",
              )}
            >
              <p className="text-xs font-semibold text-foreground">{opt.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {opt.description}
              </p>
              <p className="mt-2 text-[10px] font-mono text-muted-foreground/60">{opt.id}</p>
            </button>
          );
        })}
      </div>

      {/* Summary row */}
      {kpis.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {kpis.length} metric{kpis.length !== 1 ? "s" : ""}
          </span>
          {(
            [
              { key: "met", count: metCount },
              { key: "at-risk", count: atRiskCount },
              { key: "missed", count: missedCount },
            ] as const
          )
            .filter(({ count }) => count > 0)
            .map(({ key, count }) => {
              const token = STATUS_SUMMARY_TOKENS[key];
              return (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    token.bg,
                    token.text,
                    token.border,
                  )}
                >
                  {count} {token.label}
                </span>
              );
            })}
        </div>
      )}

      {/* Card grid or empty state */}
      {kpis.length === 0 ? (
        <AdminEmptyState kind="kpis" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {kpis.map((kpi) => (
            <CampaignAnalyticsCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}
    </div>
  );
}
