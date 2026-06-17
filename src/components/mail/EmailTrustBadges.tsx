import { cn } from "@/lib/utils";
import type { Email } from "./data";
import { getTrustStates } from "./trust-state";
import { TrustBadge, type TrustBadgeSize } from "@/features/design-system/components/trust-badge";

export interface EmailTrustBadgesProps {
  email: Email;
  /** Limit how many badges render (compact surfaces use 1). */
  max?: number;
  size?: TrustBadgeSize;
  /** Hide visible labels (tooltip + screen-reader text remain). */
  showLabels?: boolean;
  className?: string;
}

/**
 * Renders the trust badges for an email using the shared resolver + badge,
 * so list rows, the reader header, compose chips, and sender cards stay
 * perfectly consistent.
 */
export function EmailTrustBadges({
  email,
  max,
  size = "sm",
  showLabels = true,
  className,
}: EmailTrustBadgesProps) {
  const states = getTrustStates(email);
  const shown = typeof max === "number" ? states.slice(0, max) : states;

  if (shown.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {shown.map((state) => (
        <TrustBadge key={state} state={state} size={size} showLabel={showLabels} />
      ))}
    </span>
  );
}
