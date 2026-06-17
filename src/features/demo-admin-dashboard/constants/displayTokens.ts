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
