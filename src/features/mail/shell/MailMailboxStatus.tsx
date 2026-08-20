import {
  ActionButton,
  EmptyState,
  MailListSkeleton,
  MailReaderSkeleton,
} from "@/features/design-system";
import type { MailSourceView } from "../source-view";

export function MailMailboxStatus({
  view,
  onRetry,
  onSignIn,
  compact = false,
}: {
  view: MailSourceView;
  onRetry: () => void;
  onSignIn?: () => void;
  compact?: boolean;
}) {
  if (view.kind === "loading") {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <MailListSkeleton className="w-full md:w-full lg:w-full" />
        {!compact ? <MailReaderSkeleton className="hidden md:flex" /> : null}
      </div>
    );
  }

  if (view.kind === "error") {
    const signIn = view.failure.kind === "unauthorized" || view.failure.kind === "session_expired";
    return (
      <div
        role="alert"
        className={
          compact
            ? "mx-3 mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100"
            : "flex flex-1 items-center justify-center p-6"
        }
      >
        {compact ? (
          <div className="flex items-center justify-between gap-3">
            <p>{view.failure.message}</p>
            {view.failure.retryable ? (
              <ActionButton size="sm" onClick={onRetry}>
                Retry
              </ActionButton>
            ) : signIn ? (
              <ActionButton size="sm" onClick={onSignIn}>
                Sign in
              </ActionButton>
            ) : null}
          </div>
        ) : (
          <EmptyState
            eyebrow="Mailbox"
            title={signIn ? "Session expired" : "Mailbox unavailable"}
            description={view.failure.message}
            action={
              view.failure.retryable ? (
                <ActionButton onClick={onRetry}>Retry</ActionButton>
              ) : signIn ? (
                <ActionButton onClick={onSignIn}>Sign in</ActionButton>
              ) : null
            }
          />
        )}
      </div>
    );
  }

  return null;
}
