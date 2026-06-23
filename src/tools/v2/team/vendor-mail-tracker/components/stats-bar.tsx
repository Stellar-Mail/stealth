/**
 * StatsBar — summary metric cards at the top of the tool.
 *
 * Reads from the derived stats object. Uses aria-label on each card so
 * screen readers announce the value + context together.
 */

import { AlertTriangle, Bell, Clock, Mail, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: "default" | "danger" | "warning" | "success";
  className?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "default",
  className,
}: StatCardProps) {
  const accentClasses = {
    default: "text-[oklch(0.85_0.005_270)]",
    danger: "text-red-300",
    warning: "text-amber-300",
    success: "text-emerald-300",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3",
        className,
      )}
      aria-label={`${label}: ${value}`}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.04]",
          accentClasses[accent],
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p
          className={cn("text-xl font-semibold leading-none tabular-nums", accentClasses[accent])}
        >
          {value}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface StatsBarProps {
  total: number;
  unread: number;
  escalated: number;
  awaitingReply: number;
  critical: number;
  dueForFollowUp: number;
}

export function StatsBar({
  total,
  unread,
  escalated,
  awaitingReply,
  critical,
  dueForFollowUp,
}: StatsBarProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      role="region"
      aria-label="Vendor mail summary statistics"
    >
      <StatCard label="Total Threads" value={total} icon={MessageSquare} />
      <StatCard label="Unread" value={unread} icon={Mail} accent={unread > 0 ? "warning" : "default"} />
      <StatCard label="Awaiting Reply" value={awaitingReply} icon={Clock} accent={awaitingReply > 0 ? "warning" : "default"} />
      <StatCard label="Escalated" value={escalated} icon={TrendingUp} accent={escalated > 0 ? "danger" : "default"} />
      <StatCard label="Critical" value={critical} icon={AlertTriangle} accent={critical > 0 ? "danger" : "default"} />
      <StatCard label="Follow-Up Due" value={dueForFollowUp} icon={Bell} accent={dueForFollowUp > 0 ? "warning" : "default"} />
    </div>
  );
}
