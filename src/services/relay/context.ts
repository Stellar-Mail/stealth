/**
 * Relay service context factory (Issue #1935 BETA-028).
 *
 * Builds the relay service singleton for the Cloudflare worker path. Dev mode
 * uses in-memory storage; production requires the STEALTH_KV binding. This
 * module MUST NOT be imported by the Docker entry (it resolves the
 * `cloudflare:workers` binding), which constructs its own service directly.
 */
import { loadRuntimeConfig } from "@/config";
import { getApiContext, getObjectStore } from "@/server/api/context";
import { protocolManifest } from "@/server/api/protocol";
import { getVersionInfo } from "@/server/api/version";
import { getPolicyChainClient } from "@/services/stellar/policy-chain-client";

import { createRelayAdmissionEvaluator } from "./admission";
import { ingestMailboxEnvelope } from "./ingest";
import { InProcessRelayWorker } from "./in-process-worker";
import { KvMailboxSyncPersistence } from "./kv-mailbox-sync";
import { KvRelayPersistence } from "./kv-persistence";
import { MemoryMailboxSyncPersistence } from "./memory-mailbox-sync";
import { MemoryRelayPersistence } from "./memory-persistence";
import { MailboxSyncService } from "./mailbox-sync-service";
import type { MailboxSyncPersistence } from "./mailbox-sync-persistence";
import { RelayObjectStore } from "./object-store";
import { RELAY_SERVICE_NAME, RelayService, type RelayServiceConfig } from "./relay-service";

const globalRelay = globalThis as typeof globalThis & {
  __stealthRelayService?: RelayService;
  __stealthMailboxSync?: MailboxSyncService;
  __stealthMailboxSyncPersistence?: MailboxSyncPersistence;
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

async function createAdmissionOptions() {
  const { repository } = await getApiContext();
  const chainClient = getPolicyChainClient();
  const adapter = await getObjectStore();
  return {
    admission: createRelayAdmissionEvaluator({ repository, chainClient }),
    objectStore: adapter ? new RelayObjectStore(adapter) : undefined,
  };
}

async function ensureRelayRuntime(): Promise<void> {
  if (globalRelay.__stealthRelayService && globalRelay.__stealthMailboxSync) {
    return;
  }

  const admissionOptions = await createAdmissionOptions();

  if (!import.meta.env.PROD) {
    const persistence = new MemoryRelayPersistence();
    const mailboxPersistence = new MemoryMailboxSyncPersistence();
    const worker = new InProcessRelayWorker(persistence, {
      onMessage: (envelope) => ingestMailboxEnvelope(mailboxPersistence, envelope),
    });
    globalRelay.__stealthMailboxSyncPersistence = mailboxPersistence;
    globalRelay.__stealthMailboxSync = new MailboxSyncService(mailboxPersistence);
    globalRelay.__stealthRelayService = new RelayService(
      persistence,
      worker,
      buildConfig(),
      admissionOptions,
    );
    void worker.start();
    return;
  }

  const { env } = await import("cloudflare:workers");
  if (!env.STEALTH_KV) {
    throw new Error(
      "Configuration error: STEALTH_KV binding is required for the relay in production.",
    );
  }

  const persistence = new KvRelayPersistence(env.STEALTH_KV);
  const mailboxPersistence = new KvMailboxSyncPersistence(env.STEALTH_KV);
  const worker = new InProcessRelayWorker(persistence, {
    onMessage: (envelope) => ingestMailboxEnvelope(mailboxPersistence, envelope),
  });
  globalRelay.__stealthMailboxSyncPersistence = mailboxPersistence;
  globalRelay.__stealthMailboxSync = new MailboxSyncService(mailboxPersistence);
  globalRelay.__stealthRelayService = new RelayService(
    persistence,
    worker,
    buildConfig(),
    admissionOptions,
  );
  void worker.start();
}

export async function getRelayService(): Promise<RelayService> {
  await ensureRelayRuntime();
  return globalRelay.__stealthRelayService!;
}

export async function getMailboxSyncService(): Promise<MailboxSyncService> {
  await ensureRelayRuntime();
  return globalRelay.__stealthMailboxSync!;
}
