import type { ApiRepository } from "./repository";

// Read-only diagnostics; authorization and relay scoping happen above this layer.
export interface RelayDiagnostics {
  relayId: string;
  queueDepth: number;
  retryCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  deadLetterCount: number;
}

export interface RelayDiagnosticsSignals {
  isDelayed: boolean;
  isRetryStorm: boolean;
  isDegraded: boolean;
}

export type RelayDiagnosticsStatus = "healthy" | "degraded" | "failing" | "empty";

export interface RelayDiagnosticsResponse extends RelayDiagnostics {
  status: RelayDiagnosticsStatus;
  signals: RelayDiagnosticsSignals;
}

// SINGLE implementation only
export async function getRelayDiagnostics(
  repository: ApiRepository,
  relayId: string,
): Promise<RelayDiagnostics> {
  const [queueDepth, retryCount, lastSuccessAt, lastFailureAt, deadLetterCount] = await Promise.all(
    [
      repository.getRelayQueueDepth(relayId),
      repository.getRelayRetryCount(relayId),
      repository.getRelayLastSuccessfulDelivery(relayId),
      repository.getRelayLastFailedDelivery(relayId),
      repository.getRelayDeadLetterCount(relayId),
    ],
  );

  return {
    relayId,
    queueDepth,
    retryCount,
    lastSuccessAt,
    lastFailureAt,
    deadLetterCount,
  };
}

// mapper
export function toRelayDiagnosticsResponse(
  diagnostics: RelayDiagnostics,
): RelayDiagnosticsResponse {
  const isDelayed = diagnostics.queueDepth > 50;
  const isRetryStorm = diagnostics.retryCount > 20;
  const isDegraded = isDelayed || isRetryStorm || diagnostics.deadLetterCount > 0;

  const isEmpty =
    diagnostics.queueDepth === 0 &&
    diagnostics.retryCount === 0 &&
    diagnostics.deadLetterCount === 0 &&
    diagnostics.lastSuccessAt === null &&
    diagnostics.lastFailureAt === null;

  return {
    ...diagnostics,
    status: isEmpty
      ? "empty"
      : diagnostics.deadLetterCount > 5 || isRetryStorm
        ? "failing"
        : isDegraded
          ? "degraded"
          : "healthy",
    signals: {
      isDelayed,
      isRetryStorm,
      isDegraded,
    },
  };
}

// API wrapper
export async function getRelayDiagnosticsResponse(
  repository: ApiRepository,
  relayId: string,
): Promise<RelayDiagnosticsResponse> {
  return toRelayDiagnosticsResponse(await getRelayDiagnostics(repository, relayId));
}
