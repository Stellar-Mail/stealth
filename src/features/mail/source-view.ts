// ---------------------------------------------------------------------------
// BETA-053 (Issue #1960) — mailbox source view (loading / empty / ready / error).
// Pure so the shell can render truthful live state without fake delays.
// ---------------------------------------------------------------------------

import { classifyAppFailure, type ApiClientError, type AppFailureAction } from "@/lib/api";

export type MailSourceKind = "loading" | "ready" | "empty" | "error";

export type MailSourceFailureKind =
  | "unauthorized"
  | "session_expired"
  | "offline"
  | "timeout"
  | "rate_limited"
  | "dependency_failure"
  | "dependency_down"
  | "conflict"
  | "unknown";

export interface ClassifiedMailSourceError {
  kind: MailSourceFailureKind;
  message: string;
  retryable: boolean;
  error: ApiClientError;
  supportId?: string;
  actions?: AppFailureAction[];
}

export type MailSourceView =
  | { kind: "loading" }
  | { kind: "ready"; stale: boolean }
  | { kind: "empty"; stale: boolean }
  | {
      kind: "error";
      failure: ClassifiedMailSourceError;
      /** True when previous rows can still be shown. */
      hasCachedData: boolean;
    };

export interface MailSourceSignals {
  isDemoMode: boolean;
  demoReady: boolean;
  sessionLoading: boolean;
  sessionError: unknown;
  mailboxLoading: boolean;
  mailboxFetching: boolean;
  mailboxError: unknown;
  mailboxFetched: boolean;
  emailCount: number;
  online?: boolean;
}

export function classifyMailSourceError(error: unknown, online = true): ClassifiedMailSourceError {
  const classified = classifyAppFailure(error, { online });
  const kind: MailSourceFailureKind =
    classified.error.code === "session_expired"
      ? "session_expired"
      : classified.kind === "dependency_down"
        ? "dependency_down"
        : classified.kind;

  return {
    kind,
    message: classified.message,
    retryable: classified.retryable,
    error: classified.error,
    supportId: classified.supportId,
    actions: classified.actions,
  };
}

/** Decide which shell status to show from live query signals. No fake delays. */
export function resolveMailSourceView(signals: MailSourceSignals): MailSourceView {
  const online = signals.online ?? true;
  const hasEmails = signals.emailCount > 0;

  if (signals.isDemoMode) {
    if (!signals.demoReady) return { kind: "loading" };
    return hasEmails ? { kind: "ready", stale: false } : { kind: "empty", stale: false };
  }

  const failure = signals.sessionError ?? signals.mailboxError;
  if (failure) {
    return {
      kind: "error",
      failure: classifyMailSourceError(failure, online),
      hasCachedData: hasEmails,
    };
  }

  const awaitingFirstPage =
    (signals.sessionLoading || signals.mailboxLoading) && !signals.mailboxFetched && !hasEmails;
  if (awaitingFirstPage) {
    return { kind: "loading" };
  }

  if (!hasEmails && (signals.mailboxFetched || !signals.mailboxLoading)) {
    return { kind: "empty", stale: signals.mailboxFetching };
  }

  return { kind: "ready", stale: signals.mailboxFetching && hasEmails };
}
