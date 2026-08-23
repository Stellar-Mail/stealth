// ---------------------------------------------------------------------------
// BETA-071 (Issue #1978) — canonical client failure kinds and actions.
// ---------------------------------------------------------------------------

import { ApiClientError, errorLabel, isApiClientError, normalizeApiClientError } from "./errors";

export const APP_FAILURE_KINDS = [
  "offline",
  "timeout",
  "unauthorized",
  "rate_limited",
  "dependency_down",
  "conflict",
  "unknown",
] as const;

export type AppFailureKind = (typeof APP_FAILURE_KINDS)[number];

export type AppFailureAction =
  "retry" | "reauthenticate" | "copy_support_id" | "preserve_unsent_work";

export interface ClassifyAppFailureOptions {
  online?: boolean;
}

export interface ClassifiedAppFailure {
  kind: AppFailureKind;
  message: string;
  retryable: boolean;
  actions: AppFailureAction[];
  supportId?: string;
  retryAfterSeconds?: number;
  preservedWork: boolean;
  error: ApiClientError;
}

const RETRY_KINDS = new Set<AppFailureKind>([
  "offline",
  "timeout",
  "rate_limited",
  "dependency_down",
  "conflict",
]);

export function actionsForFailure(kind: AppFailureKind, supportId?: string): AppFailureAction[] {
  const actions: AppFailureAction[] = ["preserve_unsent_work"];
  if (RETRY_KINDS.has(kind)) actions.unshift("retry");
  if (kind === "unauthorized") actions.unshift("reauthenticate");
  if (supportId) actions.push("copy_support_id");
  return [...new Set(actions)];
}

export function classifyAppFailure(
  caught: unknown,
  options: ClassifyAppFailureOptions = {},
): ClassifiedAppFailure {
  const online = options.online ?? true;
  const error = normalizeApiClientError(caught);
  const raw = `${error.code} ${error.message} ${errorLabel(error)}`.toLowerCase();
  const supportId = error.requestId;

  let kind: AppFailureKind = "unknown";
  if (!online || error.code === "offline" || raw.includes("offline") || raw.includes("network")) {
    kind = "offline";
  } else if (error.code === "timeout" || raw.includes("timeout") || raw.includes("timed out")) {
    kind = "timeout";
  } else if (error.code === "unauthorized" || error.code === "session_expired") {
    kind = "unauthorized";
  } else if (error.code === "rate_limited") {
    kind = "rate_limited";
  } else if (error.code === "conflict") {
    kind = "conflict";
  } else if (error.code === "dependency_failure" || error.retryClassification === "transient") {
    kind = "dependency_down";
  } else if (error.retryable) {
    kind = "dependency_down";
  } else if (isApiClientError(caught) || error.code) {
    kind = error.code === "internal_error" ? "unknown" : "unknown";
  }

  const retryable = RETRY_KINDS.has(kind);
  return {
    kind,
    message: messageForFailure(kind, error),
    retryable,
    actions: actionsForFailure(kind, supportId),
    supportId,
    retryAfterSeconds: error.retryAfterSeconds,
    preservedWork: true,
    error,
  };
}

export function offlineAppFailure(): ClassifiedAppFailure {
  return classifyAppFailure(
    new ApiClientError({
      code: "offline",
      message: "You appear to be offline. Check your connection and retry.",
      status: 0,
      retryable: true,
      retryClassification: "transient",
    }),
    { online: false },
  );
}

function messageForFailure(kind: AppFailureKind, error: ApiClientError): string {
  switch (kind) {
    case "offline":
      return "You are offline. Mailbox sync is paused and unsent work is kept on this device.";
    case "timeout":
      return "The request timed out. Retry without sending the action again.";
    case "unauthorized":
      return errorLabel(error);
    case "rate_limited":
      return errorLabel(error);
    case "dependency_down":
      return "A required service is unavailable. Your work is saved; retry when it recovers.";
    case "conflict":
      return "This change conflicted with a newer server state. Your draft is kept; retry to reconcile.";
    default:
      return errorLabel(error);
  }
}

/** In-flight guard so reconnect never duplicates a mutation. */
export function claimOnce(pending: Set<string>, key: string): boolean {
  if (pending.has(key)) return false;
  pending.add(key);
  return true;
}

export function releaseOnce(pending: Set<string>, key: string): void {
  pending.delete(key);
}
