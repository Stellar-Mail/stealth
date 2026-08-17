import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignTimeline, Milestone, ScheduledSend } from "../types/campaignTimeline";
import {
  activeCampaignTimeline,
  draftCampaignTimeline,
} from "../fixtures/campaignTimelineFixtures";
import { getDemoNow } from "../snooze/referenceNow";
import {
  getTimelineDateRange,
  sortPhasesByStartDate,
  getPhaseDurationDays,
} from "../utils/campaignTimelineHelpers";
import {
  getPhaseToken,
  getMilestoneToken,
  getSendStatusToken,
  AUDIENCE_SEGMENT_TOKENS,
} from "../constants/displayTokens";
import { MilestoneCard } from "./MilestoneCard";
import { AdminDataTable, type Column } from "./AdminDataTable";

// ─── Warning derivation helpers (exported for unit tests) ────────────────────

export function isOverdue(milestone: Milestone, now: Date): boolean {
  return (
    milestone.status !== "resolved" &&
    milestone.status !== "skipped" &&
    new Date(milestone.dueAt) < now
  );
}

export function isImminent(send: ScheduledSend, now: Date, windowDays = 3): boolean {
  const diff = new Date(send.scheduledAt).getTime() - now.getTime();
  return send.status === "pending" && diff >= 0 && diff <= windowDays * 86_400_000;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLocalDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Phase bar ───────────────────────────────────────────────────────────────

function PhaseBar({ timeline }: { timeline: CampaignTimeline }) {
  const dateRange = getTimelineDateRange(timeline);

  if (!dateRange) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No phases defined.</p>;
  }

  const totalStart = new Date(dateRange.startsAt).getTime();
  const totalEnd = new Date(dateRange.endsAt).getTime();
  const totalMs = totalEnd - totalStart;

  const demoNow = getDemoNow().getTime();
  const nowPct = Math.min(100, Math.max(0, ((demoNow - totalStart) / totalMs) * 100));

  const sorted = sortPhasesByStartDate(timeline.phases);

  return (
    <div className="space-y-3">
      {/* Bar track */}
      <div className="relative">
        {/* "Now" needle label */}
        <div
          className="absolute -top-5 flex flex-col items-center"
          style={{ left: `${nowPct}%`, transform: "translateX(-50%)" }}
        >
          <span className="text-[9px] font-medium text-white/50 whitespace-nowrap">Now</span>
        </div>

        {/* Phase segments */}
        <div className="flex h-7 rounded-lg overflow-hidden gap-px bg-white/[0.04]">
          {sorted.map((phase) => {
            const phaseStart = new Date(phase.startAt).getTime();
            const phaseEnd = new Date(phase.endAt).getTime();
            const widthPct = ((phaseEnd - phaseStart) / totalMs) * 100;
            const token = getPhaseToken(phase.phaseKind);
            return (
              <div
                key={phase.id}
                title={`${phase.label} — ${getPhaseDurationDays(phase)}d`}
                style={{ width: `${widthPct}%` }}
                className={cn(
                  "relative flex items-center justify-center overflow-hidden transition-opacity",
                  token.bg,
                  phase.status === "upcoming" ? "opacity-40" : "opacity-100",
                )}
              >
                {phase.status === "completed" && (
                  <CheckCircle2 className={cn("h-3 w-3 shrink-0", token.text)} />
                )}
                {phase.status === "active" && (
                  <Circle className={cn("h-2.5 w-2.5 shrink-0 fill-current", token.text)} />
                )}
                {phase.status === "upcoming" && (
                  <Clock className={cn("h-3 w-3 shrink-0", token.text)} />
                )}
              </div>
            );
          })}
        </div>

        {/* "Now" needle line */}
        <div
          className="absolute top-0 h-7 w-px bg-white/60 pointer-events-none"
          style={{ left: `${nowPct}%` }}
        />
      </div>

      {/* Phase labels below the bar */}
      <div className="flex" style={{ position: "relative" }}>
        {sorted.map((phase) => {
          const phaseStart = new Date(phase.startAt).getTime();
          const phaseEnd = new Date(phase.endAt).getTime();
          const widthPct = ((phaseEnd - phaseStart) / totalMs) * 100;
          const token = getPhaseToken(phase.phaseKind);
          return (
            <div key={phase.id} style={{ width: `${widthPct}%` }} className="overflow-hidden px-1">
              <p className={cn("text-[10px] font-medium truncate", token.text)}>{phase.label}</p>
              <p className="text-[9px] text-muted-foreground whitespace-nowrap">
                {formatShortDate(phase.startAt)} – {formatShortDate(phase.endAt)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sends table ─────────────────────────────────────────────────────────────

function SendsTable({ sends, demoNow }: { sends: CampaignTimeline["sends"]; demoNow: Date }) {
  const columns: Column<ScheduledSend>[] = [
    {
      key: "label",
      header: "Label",
      sortable: true,
      render: (row) => {
        const imminent = isImminent(row, demoNow);
        return (
          <div className="flex items-center gap-2">
            {imminent && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            )}
            <span className="text-xs font-medium text-foreground">{row.label}</span>
          </div>
        );
      },
    },
    {
      key: "recipientSegmentId",
      header: "Segment",
      render: (row) => {
        const token = AUDIENCE_SEGMENT_TOKENS[row.recipientSegmentId] ?? {
          bg: "bg-white/[0.04]",
          text: "text-muted-foreground",
          border: "border-white/[0.08]",
        };
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
              token.bg,
              token.text,
              token.border,
            )}
          >
            {row.recipientSegmentId}
          </span>
        );
      },
    },
    {
      key: "estimatedCount",
      header: "Est.",
      sortable: true,
      sortValue: (row) => row.estimatedCount,
      render: (row) => (
        <span className="text-xs tabular-nums text-foreground">
          {row.estimatedCount.toLocaleString()}
        </span>
      ),
    },
    {
      key: "scheduledAt",
      header: "Scheduled",
      sortable: true,
      sortValue: (row) => row.scheduledAt,
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatLocalDate(row.scheduledAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => {
        const token = getSendStatusToken(row.status);
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
              token.bg,
              token.text,
              token.border,
            )}
          >
            {token.label}
          </span>
        );
      },
    },
  ];

  return (
    <AdminDataTable
      data={sends}
      columns={columns}
      defaultSortKey="scheduledAt"
      defaultSortDirection="asc"
      emptyMessage="No scheduled sends for this campaign."
    />
  );
}

// ─── Warning banner ───────────────────────────────────────────────────────────

function WarningBanner({
  overdueCount,
  imminentCount,
}: {
  overdueCount: number;
  imminentCount: number;
}) {
  if (overdueCount === 0 && imminentCount === 0) return null;

  const parts: string[] = [];
  if (overdueCount > 0)
    parts.push(`${overdueCount} overdue milestone${overdueCount > 1 ? "s" : ""}`);
  if (imminentCount > 0)
    parts.push(`${imminentCount} send${imminentCount > 1 ? "s" : ""} within 3 days`);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
      <p className="text-xs font-medium text-rose-300">{parts.join(" · ")}</p>
    </div>
  );
}

// ─── Campaign picker ──────────────────────────────────────────────────────────

const TIMELINE_OPTIONS = [
  {
    timeline: activeCampaignTimeline,
    label: "Investor Update Series",
    description: "Active campaign — June 2026 send window.",
  },
  {
    timeline: draftCampaignTimeline,
    label: "Q3 Early Access Campaign",
    description: "Draft campaign — July 2026 warmup planned.",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignTimelinePanel() {
  const [selectedId, setSelectedId] = useState<string>(activeCampaignTimeline.id);
  const demoNow = getDemoNow();

  const selected =
    TIMELINE_OPTIONS.find((o) => o.timeline.id === selectedId) ?? TIMELINE_OPTIONS[0];
  const timeline = selected.timeline;

  const overdueCount = timeline.milestones.filter((ms) => isOverdue(ms, demoNow)).length;
  const imminentCount = timeline.sends.filter((s) => isImminent(s, demoNow)).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Visual timeline of campaign phases, milestones, and scheduled sends. All data is
        deterministic demo data.
      </p>

      {/* Campaign picker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TIMELINE_OPTIONS.map((opt) => {
          const active = selectedId === opt.timeline.id;
          return (
            <button
              key={opt.timeline.id}
              type="button"
              onClick={() => setSelectedId(opt.timeline.id)}
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
              <p className="mt-2 text-[10px] font-mono text-muted-foreground/60">
                {opt.timeline.id}
              </p>
            </button>
          );
        })}
      </div>

      {/* Warning banner */}
      <WarningBanner overdueCount={overdueCount} imminentCount={imminentCount} />

      {/* Phase bar */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-5">
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Campaign Phases
          </h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {timeline.phases.length} phase{timeline.phases.length !== 1 ? "s" : ""} ·{" "}
            {(() => {
              const r = getTimelineDateRange(timeline);
              if (!r) return "—";
              return `${formatShortDate(r.startsAt)} – ${formatShortDate(r.endsAt)}`;
            })()}
          </p>
        </div>
        <div className="mt-6">
          <PhaseBar timeline={timeline} />
        </div>
        {/* Phase legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {sortPhasesByStartDate(timeline.phases).map((phase) => {
            const token = getPhaseToken(phase.phaseKind);
            return (
              <div key={phase.id} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", token.bg.replace("/10", "/60"))} />
                <span className={cn("text-[10px] font-medium", token.text)}>{phase.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {getPhaseDurationDays(phase)}d
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Milestones
          </h4>
          <span className="text-[10px] text-muted-foreground">
            {timeline.milestones.length} total
          </span>
        </div>
        {timeline.milestones.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No milestones for this campaign.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {timeline.milestones.map((ms) => (
              <MilestoneCard key={ms.id} milestone={ms} isOverdue={isOverdue(ms, demoNow)} />
            ))}
          </div>
        )}
      </div>

      {/* Scheduled sends */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scheduled Sends
          </h4>
          <span className="text-[10px] text-muted-foreground">{timeline.sends.length} total</span>
        </div>
        <SendsTable sends={timeline.sends} demoNow={demoNow} />
      </div>
    </div>
  );
}
