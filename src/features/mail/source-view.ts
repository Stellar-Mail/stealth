// ---------------------------------------------------------------------------
// BETA-053 (Issue #1960) — mailbox source view (loading / empty / ready / error).
// Pure so the shell can render truthful live state without fake delays.
// ---------------------------------------------------------------------------

import {
  errorLabel,
  isApiClientError,
  normalizeApiClientError,
  type ApiClientError,
} from "@/lib/api";

export type MailSourceKind = "loading" | "ready" | "empty" | "error";

export type MailSourceFailureKind =
  | "unauthorized"
  | "session_expired"
  | "offline"
  | "timeout"
  | "rate_limited"
  | "dependency_failure"
  | "unknown";

export interface ClassifiedMailSourceError {
  kind: MailSourceFailureKind;
  message: string;
  retryable: boolean;
  error: ApiClientError;
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
  const normalized = normalizeApiClientError(error);
  const message = errorLabel(normalized).toLowerCase();
  const raw = `${normalized.code} ${normalized.message} ${message}`.toLowerCase();

  if (!online || raw.includes("offline") || raw.includes("network")) {
    return {
      kind: "offline",
      message: "You appear to be offline. Check your connection and retry.",
      retryable: true,
      error: normalized,
    };
  }

  if (normalized.code === "unauthorized") {
    return {
      kind: "unauthorized",
      message: errorLabel(normalized),
      retryable: false,
      error: normalized,
    };
  }

  if (normalized.code === "session_expired") {
    return {
      kind: "session_expired",
      message: errorLabel(normalized),
      retryable: false,
      error: normalized,
    };
  }

  if (normalized.code === "rate_limited") {
    return {
      kind: "rate_limited",
      message: errorLabel(normalized),
      retryable: true,
      error: normalized,
    };
  }

  if (raw.includes("timeout") || raw.includes("timed out")) {
    return {
      kind: "timeout",
      message: "The mailbox request timed out. Retry without sending the action again.",
      retryable: true,
      error: normalized,
    };
  }

  if (
    normalized.code === "dependency_failure" ||
    normalized.retryClassification === "transient" ||
    normalized.retryable
  ) {
    return {
      kind: "dependency_failure",
      message: errorLabel(normalized),
      retryable: true,
      error: normalized,
    };
  }

  return {
    kind: "unknown",
    message: isApiClientError(error) ? errorLabel(error) : normalized.message,
    retryable: false,
    error: normalized,
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
