/**
 * Relay service context factory (Issue #1935 BETA-028).
 *
 * Builds the relay service singleton for the Cloudflare worker path. Dev mode
 * uses in-memory storage; production requires the STEALTH_KV binding. This
 * module MUST NOT be imported by the Docker entry (it resolves the
 * `cloudflare:workers` binding), which constructs its own service directly.
 */
import { loadRuntimeConfig } from "@/config";
import {
  scheduleLifecycleAnchor,
  buildLifecycleChainAdapter,
} from "@/server/api/lifecycle-service";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import type { ApiRepository } from "@/server/api/repository";
import { protocolManifest } from "@/server/api/protocol";
import { getVersionInfo } from "@/server/api/version";

import { InProcessRelayWorker } from "./in-process-worker";
import { KvRelayPersistence } from "./kv-persistence";
import { MemoryRelayPersistence } from "./memory-persistence";
import { RELAY_SERVICE_NAME, RelayService, type RelayServiceConfig } from "./relay-service";

const globalRelay = globalThis as typeof globalThis & {
  __stealthRelayService?: RelayService;
};

function buildConfig(): RelayServiceConfig {
  const config = loadRuntimeConfig();
  return {
    serviceName: RELAY_SERVICE_NAME,
    version: getVersionInfo().build,
    apiVersion: protocolManifest.apiVersion,
    protocolVersion: config.contract.protocolVersion,
    timeoutMs: 1_000,
    network: {
      horizonUrl: config.network.horizonUrl,
      sorobanRpcUrl: config.network.sorobanRpcUrl,
      networkPassphrase: config.network.networkPassphrase,
    },
  };
}

/**
 * Best-effort lifecycle-anchor scheduling after relay acceptance. Amount is
 * taken from the stored postage record for the commitment when present, else
 * "0"; verified/receiptRequired default off (the anchor record can be refined
 * by later reconciliation without touching the message commitment).
 */
function buildOnAcceptedHook(repo: ApiRepository): RelayServiceConfig["onAccepted"] {
  const config = loadRuntimeConfig();
  const adapter = buildLifecycleChainAdapter(config);
  return async ({ messageId, sender, recipient }) => {
    const postage = await repo.getPostage(messageId);
    await scheduleLifecycleAnchor(repo, {
      messageId,
      sender,
      recipient,
      amount: postage?.amount ?? "0",
      verified: false,
      receiptRequired: false,
    });
  };
}

async function getLifecycleRepository(): Promise<ApiRepository> {
  if (!import.meta.env.PROD) {
    return new MemoryApiRepository();
  }
  const { env } = await import("cloudflare:workers");
  if (!env.STEALTH_KV || !env.STEALTH_COORDINATOR) {
    throw new Error(
      "Configuration error: STEALTH_KV or STEALTH_COORDINATOR binding is required for lifecycle anchoring in production.",
    );
  }
  const { HybridApiRepository } = await import("@/server/api/kv-repository");
  return new HybridApiRepository(env.STEALTH_KV, env.STEALTH_COORDINATOR);
}

export async function getRelayService(): Promise<RelayService> {
  if (globalRelay.__stealthRelayService) {
    return globalRelay.__stealthRelayService;
  }

  if (!import.meta.env.PROD) {
    const persistence = new MemoryRelayPersistence();
    const worker = new InProcessRelayWorker(persistence);
    globalRelay.__stealthRelayService = new RelayService(persistence, worker, {
      ...buildConfig(),
      onAccepted: buildOnAcceptedHook(await getLifecycleRepository()),
    });
    return globalRelay.__stealthRelayService;
  }

  const { env } = await import("cloudflare:workers");
  if (!env.STEALTH_KV) {
    throw new Error(
      "Configuration error: STEALTH_KV binding is required for the relay in production.",
    );
  }

  const persistence = new KvRelayPersistence(env.STEALTH_KV);
  const worker = new InProcessRelayWorker(persistence);
  globalRelay.__stealthRelayService = new RelayService(persistence, worker, {
    ...buildConfig(),
    onAccepted: buildOnAcceptedHook(await getLifecycleRepository()),
  });
  return globalRelay.__stealthRelayService;
}
