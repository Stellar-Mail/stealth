import { FileDiff, MinusCircle, Pencil, PlusCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignDiffEntry, CampaignDiffKind } from "../campaignDiff";
import { compareCampaignSnapshots, formatCampaignDiffSummary } from "../campaignDiff";
import type { CampaignSnapshot } from "../types/campaignSnapshot";

export interface CampaignDiffPanelProps {
  base: CampaignSnapshot;
  comparison: CampaignSnapshot;
  className?: string;
}

export function CampaignDiffPanel({ base, comparison, className }: CampaignDiffPanelProps) {
  const result = compareCampaignSnapshots(base, comparison);

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileDiff className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Campaign diff panel</h3>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            result.hasChanges
              ? "border-amber-500/30 text-amber-300"
              : "border-emerald-500/30 text-emerald-300",
          )}
        >
          {result.hasChanges ? "needs review" : "no changes"}
        </span>
      </header>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <p className="text-sm font-medium">
          {base.name} to {comparison.name}
        </p>
        <p className="text-sm text-muted-foreground">{formatCampaignDiffSummary(result)}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <Metric label="Added" value={result.summary.added} tone="added" />
        <Metric label="Removed" value={result.summary.removed} tone="removed" />
        <Metric label="Changed" value={result.summary.changed} tone="changed" />
        <Metric label="Same" value={result.summary.unchanged} tone="unchanged" />
      </div>

      <ul className="flex flex-col gap-2">
        {result.entries.map((entry) => (
          <DiffRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function DiffRow({ entry }: { entry: CampaignDiffEntry }) {
  const Icon = getKindIcon(entry.kind);

  return (
    <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", getKindClass(entry.kind))} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{entry.label}</span>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[11px] text-muted-foreground">
              {entry.section}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p>
          {entry.kind !== "unchanged" ? (
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
              <ValueBlock label="Before" value={entry.before} />
              <ValueBlock label="After" value={entry.after} />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: CampaignDiffKind }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold", getKindClass(tone))}>{value}</p>
    </div>
  );
}

function ValueBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-foreground/80">
        {value || "None"}
      </p>
    </div>
  );
}

function getKindIcon(kind: CampaignDiffKind) {
  if (kind === "added") {
    return PlusCircle;
  }
  if (kind === "removed") {
    return MinusCircle;
  }
  if (kind === "changed") {
    return Pencil;
  }
  return ShieldCheck;
}

function getKindClass(kind: CampaignDiffKind): string {
  if (kind === "added") {
    return "text-emerald-300";
  }
  if (kind === "removed") {
    return "text-rose-300";
  }
  if (kind === "changed") {
    return "text-amber-300";
  }
  return "text-muted-foreground";
}
