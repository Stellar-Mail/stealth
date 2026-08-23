import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  Cable,
  CircleDollarSign,
  CircleHelp,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Canonical sender-trust states shared across every mail surface.
 * Standardizing these here keeps labels and colors identical everywhere.
 */
export type TrustState =
  | "verified"
  | "allowed"
  | "unknown"
  | "paid"
  | "blocked"
  | "bridged"
  | "encrypted";

export type TrustStateMeta = {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  /** Border/background/text tokens — text is always present, never color-only. */
  className: string;
};

export const TRUST_STATE_META: Record<TrustState, TrustStateMeta> = {
  verified: {
    label: "Verified",
    tooltip: "This sender's Stellar identity has been cryptographically verified.",
    icon: BadgeCheck,
    className: "border-zinc-300/25 bg-zinc-300/10 text-zinc-200",
  },
  allowed: {
    label: "Allowed",
    tooltip: "You've marked this sender as a trusted contact.",
    icon: BadgeCheck,
    className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  },
  unknown: {
    label: "Unknown",
    tooltip: "This sender hasn't been verified or added to your contacts yet.",
    icon: CircleHelp,
    className: "border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
  },
  paid: {
    label: "Paid",
    tooltip: "This sender attached postage to reach your inbox.",
    icon: CircleDollarSign,
    className: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  },
  blocked: {
    label: "Blocked",
    tooltip: "Mail from this sender is rejected and moved to spam.",
    icon: Ban,
    className: "border-red-300/25 bg-red-300/10 text-red-200",
  },
  bridged: {
    label: "Bridged",
    tooltip: "Delivered over an email bridge, so it can't be fully verified.",
    icon: Cable,
    className: "border-violet-300/25 bg-violet-300/10 text-violet-200",
  },
  encrypted: {
    label: "Encrypted",
    tooltip: "This message's contents are end-to-end encrypted.",
    icon: Lock,
    className: "border-teal-300/25 bg-teal-300/10 text-teal-200",
  },
};

export type TrustBadgeSize = "sm" | "md";

export interface TrustBadgeProps {
  state: TrustState;
  /** Hide the visible text (icon + tooltip + screen-reader label remain). */
  showLabel?: boolean;
  /** Wrap in a tooltip explaining the state. Defaults to true. */
  showTooltip?: boolean;
  size?: TrustBadgeSize;
  className?: string;
}

/**
 * A single, consistent sender-trust pill. Presentational only so it can be
 * reused in list rows, the reader header, compose chips, and sender cards.
 */
export const TrustBadge = memo(function TrustBadge({
  state,
  showLabel = true,
  showTooltip = true,
  size = "sm",
  className,
}: TrustBadgeProps) {
  const meta = TRUST_STATE_META[state];
  const Icon = meta.icon;

  if (state === "verified" && !showLabel) {
    const check = (
      <span
        className={cn(
          "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-zinc-300/35 bg-gradient-to-b from-zinc-500/70 to-zinc-800/90 text-zinc-100 shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]",
          className,
        )}
        aria-label={meta.label}
      >
        <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      </span>
    );

    if (!showTooltip) return check;

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{check}</TooltipTrigger>
          <TooltipContent>{meta.tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium leading-none",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        meta.className,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </span>
  );

  if (!showTooltip) return pill;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent>{meta.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
