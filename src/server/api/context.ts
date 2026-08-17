import { MemoryApiRepository } from "./memory-repository";
import type { ApiRepository } from "./repository";

interface ApiContext {
  repository: ApiRepository;
}

const globalApi = globalThis as typeof globalThis & {
  __stealthApiRepository?: MemoryApiRepository;
};

export function getApiContext(): ApiContext {
  globalApi.__stealthApiRepository ??= new MemoryApiRepository();
  return { repository: globalApi.__stealthApiRepository };
}

export function setApiContext(context: ApiContext): void {
  if (context.repository instanceof MemoryApiRepository) {
    globalApi.__stealthApiRepository = context.repository;
  }
}

export function resetApiContext(): void {
  if (globalApi.__stealthApiRepository) {
    globalApi.__stealthApiRepository.reset();
  } else {
    globalApi.__stealthApiRepository = new MemoryApiRepository();
  }
}
