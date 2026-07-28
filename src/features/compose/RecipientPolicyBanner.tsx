import { AlertCircle, Ban, CheckCircle2, Coins, Loader2, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PostageQuoteState } from "./usePostageQuote";

interface RecipientPolicyBannerProps {
  quoteState: PostageQuoteState;
  className?: string;
}

type BannerVariant =
  "trusted" | "blocked" | "postage_required" | "verification_required" | "loading" | "error";

interface BannerConfig {
  variant: BannerVariant;
  Icon: typeof CheckCircle2;
  label: string;
  detail?: string;
  containerClass: string;
  iconClass: string;
}

function xlmFromStroops(stroops: string): string {
  try {
    const n = BigInt(stroops);
    // 1 XLM = 10,000,000 stroops
    const whole = n / 10_000_000n;
    const frac = n % 10_000_000n;
    if (frac === 0n) return `${whole}`;
    // Show up to 7 decimal places, trimming trailing zeros
    const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return stroops;
  }
}

function getBannerConfig(quoteState: PostageQuoteState): BannerConfig | null {
  if (quoteState.status === "idle") return null;

  if (quoteState.status === "loading") {
    return {
      variant: "loading",
      Icon: Loader2,
      label: "Checking recipient policy…",
      containerClass: "border-blue-300/20 bg-blue-300/[0.05] text-blue-200",
      iconClass: "motion-safe:animate-spin text-blue-400",
    };
  }

  if (quoteState.status === "error") {
    return {
      variant: "error",
      Icon: AlertCircle,
      label: "Policy check failed",
      detail: "Delivery requirements could not be verified — proceed with caution",
      containerClass: "border-amber-300/20 bg-amber-300/[0.05] text-amber-200",
      iconClass: "text-amber-400",
    };
  }

  const { quote } = quoteState;

  if (!quote.eligible || quote.reason === "sender_blocked") {
    return {
      variant: "blocked",
      Icon: Ban,
      label: "Recipient has blocked this sender",
      detail: "This address cannot receive messages from you",
      containerClass: "border-red-300/20 bg-red-300/[0.05] text-red-200",
      iconClass: "text-red-400",
    };
  }

  if (quote.reason === "unknown_senders_disabled") {
    return {
      variant: "blocked",
      Icon: Ban,
      label: "Recipient does not accept messages from unknown senders",
      detail: "You must be an approved contact to send to this address",
      containerClass: "border-red-300/20 bg-red-300/[0.05] text-red-200",
      iconClass: "text-red-400",
    };
  }

  if (quote.reason === "verification_required") {
    return {
      variant: "verification_required",
      Icon: ShieldAlert,
      label: "Recipient requires verified identity",
      detail: "Your account must be verified before sending to this address",
      containerClass: "border-amber-300/20 bg-amber-300/[0.05] text-amber-200",
      iconClass: "text-amber-400",
    };
  }

  if (quote.trusted) {
    return {
      variant: "trusted",
      Icon: CheckCircle2,
      label: "Trusted sender — no postage required",
      detail: "You are on this recipient's allow list",
      containerClass: "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200",
      iconClass: "text-emerald-400",
    };
  }

  // Postage required (mailbox_minimum)
  const xlm = xlmFromStroops(quote.amount);
  return {
    variant: "postage_required",
    Icon: Coins,
    label: `Minimum postage: ${xlm} XLM required`,
    detail: "This recipient's policy requires postage to accept messages from unknown senders",
    containerClass: "border-amber-300/20 bg-amber-300/[0.05] text-amber-200",
    iconClass: "text-amber-400",
  };
}

/**
 * Compact banner displayed in the compose header showing the recipient's policy
 * outcome: trusted (free), blocked, postage required, or verification required.
 *
 * Error states are dismissible and do not block send.
 */
export function RecipientPolicyBanner({
  quoteState,
  className,
}: Readonly<RecipientPolicyBannerProps>) {
  const [dismissed, setDismissed] = useState(false);

  const config = getBannerConfig(quoteState);

  // Reset dismissal when quote state changes significantly
  const isError = quoteState.status === "error";

  if (!config) return null;
  if (isError && dismissed) return null;

  const { Icon, label, detail, containerClass, iconClass } = config;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Recipient policy: ${label}`}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] transition-all",
        containerClass,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconClass)} />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        {detail && <span className="ml-1 opacity-75">— {detail}</span>}
      </div>
      {isError && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss policy error"
          className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Returns true when the policy outcome actively blocks sending.
 * An API error is NOT blocking — callers must decide whether to allow send.
 */
export function isPolicyBlocking(quoteState: PostageQuoteState): boolean {
  if (quoteState.status !== "quoted") return false;
  const { quote } = quoteState;
  return !quote.eligible;
}

/**
 * Returns true when the sender is trusted and postage is free.
 */
export function isTrustedSender(quoteState: PostageQuoteState): boolean {
  if (quoteState.status !== "quoted") return false;
  return quoteState.quote.trusted;
}

/**
 * Returns the minimum postage amount in stroops as a string, or null if
 * unknown / not applicable.
 */
export function getMinimumPostage(quoteState: PostageQuoteState): string | null {
  if (quoteState.status !== "quoted") return null;
  const { quote } = quoteState;
  if (quote.trusted) return "0";
  if (!quote.eligible) return null;
  return quote.amount;
}

/**
 * Converts stroops to XLM string for display — exported for testing.
 */
export { xlmFromStroops };
