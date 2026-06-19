import { AlertTriangle, CheckCircle2, Circle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  buildCampaignPublishChecklist,
  summarizeCampaignPublishChecklist,
  type CampaignPublishChecklistItem,
} from "../campaignPublishChecklist";

export interface CampaignPublishChecklistPanelProps {
  campaign: CampaignSnapshot;
  className?: string;
}

export function CampaignPublishChecklistPanel({
  campaign,
  className,
}: CampaignPublishChecklistPanelProps) {
  const result = buildCampaignPublishChecklist(campaign);

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Campaign publish checklist</h3>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            result.canPublish
              ? "border-emerald-500/30 text-emerald-300"
              : "border-rose-500/30 text-rose-300",
          )}
        >
          {result.canPublish ? "publishable" : "blocked"}
        </span>
      </header>

      <p className="text-sm text-muted-foreground">{summarizeCampaignPublishChecklist(result)}</p>

      <ul className="flex flex-col gap-2">
        {result.items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Ready" value={result.readyCount} tone="ready" />
        <Metric label="Warnings" value={result.warningCount} tone="warning" />
        <Metric label="Blockers" value={result.blockerCount} tone="blocker" />
      </div>
    </section>
  );
}

function ChecklistRow({ item }: { item: CampaignPublishChecklistItem }) {
  const Icon = item.passed ? CheckCircle2 : item.severity === "warning" ? AlertTriangle : Circle;
  return (
    <li className="flex gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          item.passed
            ? "text-emerald-300"
            : item.severity === "warning"
              ? "text-amber-300"
              : "text-rose-300",
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="block text-xs text-muted-foreground">{item.description}</span>
      </span>
    </li>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ready" | "warning" | "blocker";
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold",
          tone === "ready" && "text-emerald-300",
          tone === "warning" && "text-amber-300",
          tone === "blocker" && "text-rose-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}
