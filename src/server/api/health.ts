import { getApiContext } from "./context";
import type { ApiRepository } from "./repository";

const DEFAULT_READINESS_TIMEOUT_MS = 1_000;
const HEALTH_POLICY_OWNER = `G${"H".repeat(55)}`;
const HEALTH_COORDINATOR_KEY = "health:readiness";

type HealthCheckName = "bindings" | "coordinator" | "storage";
type HealthCheckStatus = "ok" | "timeout" | "unavailable";

type SubsystemName =
  | "bindings"
  | "coordinator"
  | "storage"
  | "relay"
  | "indexer"
  | "queue"
  | "rpc"
  | "policy";

interface HealthDependencyResult {
  name: HealthCheckName;
  status: HealthCheckStatus;
}

interface SubsystemDependencyResult {
  name: SubsystemName;
  status: HealthCheckStatus;
}

interface ReadinessOptions {
  getContext?: typeof getApiContext;
  timeoutMs?: number;
}

interface ReadinessResult {
  dependencies: Record<HealthCheckName, HealthCheckStatus>;
  ready: boolean;
  timeoutMs: number;
}

interface DetailedHealthResult extends ReadinessResult {
  status: "healthy" | "degraded" | "unhealthy";
  subsystems: Record<SubsystemName, HealthCheckStatus>;
  timestamp: string;
}

function timeoutResult(name: HealthCheckName): HealthDependencyResult {
  return { name, status: "timeout" };
}

function subsystemTimeoutResult(name: SubsystemName): SubsystemDependencyResult {
  return { name, status: "timeout" };
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkStorage(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<HealthDependencyResult> {
  return withTimeout(
    repository
      .getPolicy(HEALTH_POLICY_OWNER)
      .then(() => ({ name: "storage", status: "ok" }) as const)
      .catch(() => ({ name: "storage", status: "unavailable" }) as const),
    timeoutMs,
    () => timeoutResult("storage"),
  );
}

async function checkCoordinator(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<HealthDependencyResult> {
  return withTimeout(
    repository
      .getCounter(HEALTH_COORDINATOR_KEY)
      .then(() => ({ name: "coordinator", status: "ok" }) as const)
      .catch(() => ({ name: "coordinator", status: "unavailable" }) as const),
    timeoutMs,
    () => timeoutResult("coordinator"),
  );
}

async function checkRelayProbe(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<SubsystemDependencyResult> {
  return withTimeout(
    Promise.resolve(
      typeof repository.getRelayQueueDepth === "function"
        ? repository.getRelayQueueDepth("health:relay:probe")
        : repository.getCounter("health:relay"),
    )
      .then(() => ({ name: "relay", status: "ok" }) as const)
      .catch(() => ({ name: "relay", status: "unavailable" }) as const),
    timeoutMs,
    () => subsystemTimeoutResult("relay"),
  );
}

async function checkIndexerProbe(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<SubsystemDependencyResult> {
  return withTimeout(
    Promise.resolve(
      typeof repository.getReceipt === "function"
        ? repository.getReceipt("health:indexer:probe")
        : repository.getCounter("health:indexer"),
    )
      .then(() => ({ name: "indexer", status: "ok" }) as const)
      .catch(() => ({ name: "indexer", status: "unavailable" }) as const),
    timeoutMs,
    () => subsystemTimeoutResult("indexer"),
  );
}

async function checkQueueProbe(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<SubsystemDependencyResult> {
  return withTimeout(
    Promise.resolve(
      typeof repository.getRelayDeadLetterCount === "function"
        ? repository.getRelayDeadLetterCount("health:queue:probe")
        : repository.getCounter("health:queue"),
    )
      .then(() => ({ name: "queue", status: "ok" }) as const)
      .catch(() => ({ name: "queue", status: "unavailable" }) as const),
    timeoutMs,
    () => subsystemTimeoutResult("queue"),
  );
}

async function checkRpcProbe(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<SubsystemDependencyResult> {
  return withTimeout(
    Promise.resolve(
      typeof repository.getPostage === "function"
        ? repository.getPostage("health:rpc:probe")
        : repository.getCounter("health:rpc"),
    )
      .then(() => ({ name: "rpc", status: "ok" }) as const)
      .catch(() => ({ name: "rpc", status: "unavailable" }) as const),
    timeoutMs,
    () => subsystemTimeoutResult("rpc"),
  );
}

async function checkPolicyProbe(
  repository: ApiRepository,
  timeoutMs: number,
): Promise<SubsystemDependencyResult> {
  return withTimeout(
    Promise.resolve(
      typeof repository.getSenderRule === "function"
        ? repository.getSenderRule(HEALTH_POLICY_OWNER, "health:sender:probe")
        : repository.getPolicy(HEALTH_POLICY_OWNER),
    )
      .then(() => ({ name: "policy", status: "ok" }) as const)
      .catch(() => ({ name: "policy", status: "unavailable" }) as const),
    timeoutMs,
    () => subsystemTimeoutResult("policy"),
  );
}

/**
 * Checks core API readiness against Cloudflare bindings, durable coordinator,
 * and encrypted storage repository.
 */
export async function checkApiReadiness(options: ReadinessOptions = {}): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  const contextResult = await withTimeout<{
    status: "ok" | "unavailable" | "timeout";
    repository: ApiRepository | null;
  }>(
    (options.getContext ?? getApiContext)()
      .then((context) => ({
        status: "ok" as const,
        repository: context.repository,
      }))
      .catch(() => ({ status: "unavailable" as const, repository: null })),
    timeoutMs,
    () => ({ status: "timeout" as const, repository: null }),
  );

  if (!contextResult.repository) {
    return {
      dependencies: {
        bindings: contextResult.status,
        coordinator: "unavailable",
        storage: "unavailable",
      },
      ready: false,
      timeoutMs,
    };
  }

  const results = await Promise.all([
    checkStorage(contextResult.repository, timeoutMs),
    checkCoordinator(contextResult.repository, timeoutMs),
  ]);

  const dependencies: ReadinessResult["dependencies"] = {
    bindings: "ok",
    coordinator: "unavailable",
    storage: "unavailable",
  };

  for (const result of results) {
    dependencies[result.name] = result.status;
  }

  return {
    dependencies,
    ready: Object.values(dependencies).every((status) => status === "ok"),
    timeoutMs,
  };
}

/**
 * Comprehensive health inspection across all eight beta operational subsystems:
 * bindings, coordinator, storage, relay, indexer, queue, rpc, and policy.
 * Each subsystem executes an independent health probe.
 */
export async function checkDetailedHealth(
  options: ReadinessOptions = {},
): Promise<DetailedHealthResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  const now = new Date().toISOString();

  const contextResult = await withTimeout<{
    status: "ok" | "unavailable" | "timeout";
    repository: ApiRepository | null;
  }>(
    (options.getContext ?? getApiContext)()
      .then((context) => ({
        status: "ok" as const,
        repository: context.repository,
      }))
      .catch(() => ({ status: "unavailable" as const, repository: null })),
    timeoutMs,
    () => ({ status: "timeout" as const, repository: null }),
  );

  if (!contextResult.repository) {
    const allUnavailable: Record<SubsystemName, HealthCheckStatus> = {
      bindings: contextResult.status,
      coordinator: "unavailable",
      storage: "unavailable",
      relay: "unavailable",
      indexer: "unavailable",
      queue: "unavailable",
      rpc: "unavailable",
      policy: "unavailable",
    };

    return {
      dependencies: {
        bindings: contextResult.status,
        coordinator: "unavailable",
        storage: "unavailable",
      },
      subsystems: allUnavailable,
      ready: false,
      status: "unhealthy",
      timeoutMs,
      timestamp: now,
    };
  }

  const repo = contextResult.repository;
  const [
    storageResult,
    coordinatorResult,
    relayResult,
    indexerResult,
    queueResult,
    rpcResult,
    policyResult,
  ] = await Promise.all([
    checkStorage(repo, timeoutMs),
    checkCoordinator(repo, timeoutMs),
    checkRelayProbe(repo, timeoutMs),
    checkIndexerProbe(repo, timeoutMs),
    checkQueueProbe(repo, timeoutMs),
    checkRpcProbe(repo, timeoutMs),
    checkPolicyProbe(repo, timeoutMs),
  ]);

  const dependencies: ReadinessResult["dependencies"] = {
    bindings: "ok",
    coordinator: coordinatorResult.status,
    storage: storageResult.status,
  };

  const subsystems: Record<SubsystemName, HealthCheckStatus> = {
    bindings: "ok",
    coordinator: coordinatorResult.status,
    storage: storageResult.status,
    relay: relayResult.status,
    indexer: indexerResult.status,
    queue: queueResult.status,
    rpc: rpcResult.status,
    policy: policyResult.status,
  };

  const allSubsystemsOk = Object.values(subsystems).every((s) => s === "ok");
  const anySubsystemOk = Object.values(subsystems).some((s) => s === "ok");

  let status: DetailedHealthResult["status"] = "unhealthy";
  if (allSubsystemsOk) {
    status = "healthy";
  } else if (anySubsystemOk) {
    status = "degraded";
  }

  return {
    dependencies,
    ready: Object.values(dependencies).every((s) => s === "ok") && allSubsystemsOk,
    status,
    subsystems,
    timeoutMs,
    timestamp: now,
  };
}

export type {
  HealthCheckName,
  HealthCheckStatus,
  SubsystemName,
  HealthDependencyResult,
  SubsystemDependencyResult,
  ReadinessOptions,
  ReadinessResult,
  DetailedHealthResult,
};
