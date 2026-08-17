/**
 * Relay service context factory (Issue #1935 BETA-028).
 *
 * Builds the relay service singleton for the Cloudflare worker path. Dev mode
 * uses in-memory storage; production requires the STEALTH_KV binding. This
 * module MUST NOT be imported by the Docker entry (it resolves the
 * `cloudflare:workers` binding), which constructs its own service directly.
 */
import { loadRuntimeConfig } from "@/config";
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

export async function getRelayService(): Promise<RelayService> {
  if (globalRelay.__stealthRelayService) {
    return globalRelay.__stealthRelayService;
  }

  if (!import.meta.env.PROD) {
    const persistence = new MemoryRelayPersistence();
    const worker = new InProcessRelayWorker(persistence);
    globalRelay.__stealthRelayService = new RelayService(persistence, worker, buildConfig());
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
  globalRelay.__stealthRelayService = new RelayService(persistence, worker, buildConfig());
  return globalRelay.__stealthRelayService;
}
