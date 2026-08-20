import { EmptyState, MailListSkeleton, MailReaderSkeleton } from "@/features/design-system";
import { DegradedStateBanner } from "@/features/design-system/feedback/DegradedStateBanner";
import { classifyAppFailure } from "@/lib/api";
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
    const failure = classifyAppFailure(view.failure.error, {
      online: view.failure.kind !== "offline",
    });
    const signIn = failure.kind === "unauthorized";

    if (compact) {
      return (
        <DegradedStateBanner
          failure={failure}
          compact
          onRetry={onRetry}
          onReauthenticate={onSignIn}
        />
      );
    }

    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          eyebrow="Mailbox"
          title={signIn ? "Session expired" : "Mailbox unavailable"}
          description={view.failure.message}
          action={
            <DegradedStateBanner
              failure={failure}
              className="mx-0 mt-0"
              onRetry={onRetry}
              onReauthenticate={onSignIn}
            />
          }
        />
      </div>
    );
  }

  return null;
}
