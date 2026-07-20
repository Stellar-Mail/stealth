import { MemoryApiRepository } from "./memory-repository";
import type { ApiRepository } from "./repository";

interface ApiContext {
  repository: ApiRepository;
}

const globalApi = globalThis as typeof globalThis & {
  __stealthApiRepository?: ApiRepository;
};

export async function getApiContext(): Promise<ApiContext> {
  if (!import.meta.env.PROD) {
    globalApi.__stealthApiRepository ??= new MemoryApiRepository();
    return { repository: globalApi.__stealthApiRepository };
  }

  if (globalApi.__stealthApiRepository) {
    return { repository: globalApi.__stealthApiRepository };
  }

  const { env } = await import("cloudflare:workers");
  if (!env.STEALTH_KV || !env.STEALTH_COORDINATOR) {
    throw new Error(
      "Configuration error: STEALTH_KV or STEALTH_COORDINATOR binding is not declared in wrangler.jsonc. " +
        "Make sure to create the KV namespace and declare both KV and Durable Object bindings in wrangler.jsonc.",
    );
  }

  const { HybridApiRepository } = await import("./kv-repository");
  globalApi.__stealthApiRepository = new HybridApiRepository(
    env.STEALTH_KV,
    env.STEALTH_COORDINATOR,
  );
  return { repository: globalApi.__stealthApiRepository };
}
