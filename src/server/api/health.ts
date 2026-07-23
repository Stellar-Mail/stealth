import { getApiContext } from "./context";
import type { ApiRepository } from "./repository";

const DEFAULT_READINESS_TIMEOUT_MS = 1_000;
const HEALTH_POLICY_OWNER = `G${"H".repeat(55)}`;
const HEALTH_COORDINATOR_KEY = "health:readiness";

type HealthCheckName = "bindings" | "coordinator" | "storage";
type HealthCheckStatus = "ok" | "timeout" | "unavailable";

interface HealthDependencyResult {
  name: HealthCheckName;
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

function timeoutResult(name: HealthCheckName): HealthDependencyResult {
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

export async function checkApiReadiness(options: ReadinessOptions = {}): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  const contextResult = await withTimeout<{
    status: "ok" | "unavailable" | "timeout";
    repository: ApiRepository | null;
  }>(
    (options.getContext ?? getApiContext)()
      .then((context) => ({ status: "ok" as const, repository: context.repository }))
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

export type { HealthCheckName, HealthCheckStatus, ReadinessResult };
