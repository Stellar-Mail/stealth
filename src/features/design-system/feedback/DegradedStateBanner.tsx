import { Copy, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";

import { ActionButton } from "../components/action-button";
import { cn } from "@/lib/utils";
import type { ClassifiedAppFailure } from "@/lib/api";

export function DegradedStateBanner({
  failure,
  onRetry,
  onReauthenticate,
  compact = false,
  className,
}: {
  failure: ClassifiedAppFailure;
  onRetry?: () => void;
  onReauthenticate?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const copySupportId = failure.actions.includes("copy_support_id") && failure.supportId;
  const retry = failure.actions.includes("retry") && onRetry;
  const signIn = failure.actions.includes("reauthenticate") && onReauthenticate;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        compact
          ? "mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-50"
          : "mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-50",
        className,
      )}
    >
      {failure.kind === "offline" ? (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <p className="min-w-0 flex-1">{failure.message}</p>
      {failure.preservedWork ? (
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-100/80">
          Work kept
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {retry ? (
          <ActionButton size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </ActionButton>
        ) : null}
        {signIn ? (
          <ActionButton size="sm" onClick={onReauthenticate}>
            Sign in
          </ActionButton>
        ) : null}
        {copySupportId ? (
          <ActionButton
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(failure.supportId ?? "");
            }}
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy support ID
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}
