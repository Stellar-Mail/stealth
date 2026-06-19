import type { KpiMetricKind, KpiStatus } from "../types/campaignKpi";

export interface DisplayToken {
  bg: string;
  text: string;
  border: string;
  label: string;
}

export const CAMPAIGN_STATUS_TOKENS: Record<
  "active" | "draft" | "needs-review" | "archived",
  DisplayToken
> = {
  active: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Active",
  },
  draft: {
    bg: "bg-white/[0.04]",
    text: "text-muted-foreground",
    border: "border-white/[0.08]",
    label: "Draft",
  },
  "needs-review": {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Needs Review",
  },
  archived: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    label: "Archived",
  },
};

export const TAG_COLOR_TOKENS: Record<string, DisplayToken> = {
  onboarding: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    label: "Onboarding",
  },
  welcome: {
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/20",
    label: "Welcome",
  },
  stellar: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    label: "Stellar",
  },
  security: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Security",
  },
  alert: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    label: "Alert",
  },
  newsletter: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Newsletter",
  },
  marketing: {
    bg: "bg-fuchsia-500/10",
    text: "text-fuchsia-400",
    border: "border-fuchsia-500/20",
    label: "Marketing",
  },
  announcement: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    label: "Announcement",
  },
  default: {
    bg: "bg-white/[0.04]",
    text: "text-muted-foreground",
    border: "border-white/[0.08]",
    label: "Tag",
  },
};

export const AUDIENCE_SEGMENT_TOKENS: Record<string, DisplayToken> = {
  investors: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/20",
    label: "Investors",
  },
  founders: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
    label: "Founders",
  },
  events: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    label: "Event Attendees",
  },
  "relay-operators": {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    label: "Relay Operators",
  },
  "unknown-senders": {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
    label: "Unknown Senders",
  },
};

export const AUDIENCE_BADGE_TOKENS: Record<string, DisplayToken> = {
  "New Signups": {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    label: "New Signups",
  },
  "High-Value Accounts": {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "High-Value Accounts",
  },
  "Newsletter Subscribers": {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Newsletter Subscribers",
  },
  ...AUDIENCE_SEGMENT_TOKENS,
  default: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    label: "Target Audience",
  },
};

export function getTagToken(tag: string): DisplayToken {
  const normalized = tag.toLowerCase().trim();
  return (
    TAG_COLOR_TOKENS[normalized] || {
      bg: TAG_COLOR_TOKENS.default.bg,
      text: TAG_COLOR_TOKENS.default.text,
      border: TAG_COLOR_TOKENS.default.border,
      label: tag,
    }
  );
}

export function getAudienceToken(audience: string): DisplayToken {
  const trimmed = audience.trim();
  return (
    AUDIENCE_BADGE_TOKENS[trimmed] || {
      bg: AUDIENCE_BADGE_TOKENS.default.bg,
      text: AUDIENCE_BADGE_TOKENS.default.text,
      border: AUDIENCE_BADGE_TOKENS.default.border,
      label: audience,
    }
  );
}

export const CAMPAIGN_PHASE_TOKENS: Record<
  "planning" | "warmup" | "active" | "cooldown" | "completed" | "paused",
  DisplayToken
> = {
  planning: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
    label: "Planning",
  },
  warmup: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    label: "Warmup",
  },
  active: {
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/20",
    label: "Active",
  },
  cooldown: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    label: "Cooldown",
  },
  completed: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    label: "Completed",
  },
  paused: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
    label: "Paused",
  },
};

export const MILESTONE_KIND_TOKENS: Record<
  "launch" | "review" | "approval" | "analysis" | "custom",
  DisplayToken
> = {
  launch: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    label: "Launch",
  },
  review: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
    label: "Review",
  },
  approval: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/20",
    label: "Approval",
  },
  analysis: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    label: "Analysis",
  },
  custom: {
    bg: "bg-white/[0.04]",
    text: "text-muted-foreground",
    border: "border-white/[0.08]",
    label: "Custom",
  },
};

export function getPhaseToken(kind: string): DisplayToken {
  const key = kind as keyof typeof CAMPAIGN_PHASE_TOKENS;
  return (
    CAMPAIGN_PHASE_TOKENS[key] ?? {
      bg: "bg-white/[0.04]",
      text: "text-muted-foreground",
      border: "border-white/[0.08]",
      label: kind,
    }
  );
}

export const MILESTONE_STATUS_TOKENS: Record<
  "pending" | "resolved" | "overdue" | "skipped",
  DisplayToken
> = {
  pending: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Pending",
  },
  resolved: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Resolved",
  },
  overdue: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    label: "Overdue",
  },
  skipped: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
    label: "Skipped",
  },
};

export const SCHEDULED_SEND_STATUS_TOKENS: Record<
  "pending" | "sent" | "failed" | "cancelled",
  DisplayToken
> = {
  pending: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Pending",
  },
  sent: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Sent",
  },
  failed: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    label: "Failed",
  },
  cancelled: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
    label: "Cancelled",
  },
};

export function getMilestoneStatusToken(status: string): DisplayToken {
  const key = status as keyof typeof MILESTONE_STATUS_TOKENS;
  return (
    MILESTONE_STATUS_TOKENS[key] ?? {
      bg: "bg-white/[0.04]",
      text: "text-muted-foreground",
      border: "border-white/[0.08]",
      label: status,
    }
  );
}

export function getSendStatusToken(status: string): DisplayToken {
  const key = status as keyof typeof SCHEDULED_SEND_STATUS_TOKENS;
  return (
    SCHEDULED_SEND_STATUS_TOKENS[key] ?? {
      bg: "bg-white/[0.04]",
      text: "text-muted-foreground",
      border: "border-white/[0.08]",
      label: status,
    }
  );
}

export function getMilestoneToken(kind: string): DisplayToken {
  const key = kind as keyof typeof MILESTONE_KIND_TOKENS;
  return (
    MILESTONE_KIND_TOKENS[key] ?? {
      bg: "bg-white/[0.04]",
      text: "text-muted-foreground",
      border: "border-white/[0.08]",
      label: kind,
    }
  );
}

// Campaign KPI display tokens (issue #262)
export const KPI_METRIC_TOKENS: Record<KpiMetricKind, DisplayToken> = {
  opens: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    label: "Opens",
  },
  approvals: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Approvals",
  },
  replies: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/20",
    label: "Replies",
  },
  refunds: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    label: "Refunds",
  },
  proof_inspections: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Proof Inspections",
  },
  conversions: {
    bg: "bg-fuchsia-500/10",
    text: "text-fuchsia-400",
    border: "border-fuchsia-500/20",
    label: "Conversions",
  },
};

export const KPI_STATUS_TOKENS: Record<KpiStatus, DisplayToken> = {
  "on-track": {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "On Track",
  },
  "at-risk": {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "At Risk",
  },
  met: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
    label: "Met",
  },
  missed: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    label: "Missed",
  },
};

export function getKpiMetricToken(metric: KpiMetricKind): DisplayToken {
  return KPI_METRIC_TOKENS[metric];
}

export function getKpiStatusToken(status: KpiStatus): DisplayToken {
  return KPI_STATUS_TOKENS[status];
}
