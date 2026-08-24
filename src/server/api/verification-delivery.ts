import { loadRuntimeConfig } from "@/config";
import type { ConfigProfile, NotificationsConfig } from "@/config/schema";
import { createNotificationAdapter, type NotificationAdapter } from "@/services/notifications";

/**
 * BETA-005: Resolution of the delivery configuration for verification
 * messages, resolved from the runtime config contract (BETA-001).
 *
 * The adapter is memoized per process so the local-development capture sink
 * keeps buffered messages across requests; production always constructs the
 * SMTP transport and fails fast when the deployment is misconfigured.
 */

export interface VerificationDeliveryConfig {
  profile: ConfigProfile;
  notifications: NotificationsConfig;
  appUrl: string;
}

let cachedDelivery: VerificationDeliveryConfig | null = null;

export async function getVerificationDeliveryConfig(): Promise<VerificationDeliveryConfig> {
  if (cachedDelivery) return cachedDelivery;

  if (import.meta.env.PROD) {
    const { env } = await import("cloudflare:workers");
    const config = loadRuntimeConfig({
      profile: "production",
      env: env as unknown as Record<string, unknown>,
    });
    cachedDelivery = {
      profile: config.profile,
      notifications: config.notifications,
      appUrl: config.origin.appUrl,
    };
    return cachedDelivery;
  }

  const config = loadRuntimeConfig({ profile: "development" });
  cachedDelivery = {
    profile: config.profile,
    notifications: config.notifications,
    appUrl: config.origin.appUrl,
  };
  return cachedDelivery;
}

let adapterOverride: NotificationAdapter | null = null;

/**
 * Test-only seam: installs a fixed adapter (e.g. a pre-created capture sink)
 * so route-level tests can inspect delivered messages. Never invoked by the
 * production path.
 */
export function setVerificationAdapterForTesting(adapter: NotificationAdapter | null): void {
  adapterOverride = adapter;
}

export async function getVerificationNotificationAdapter(): Promise<NotificationAdapter> {
  if (adapterOverride) return adapterOverride;
  const delivery = await getVerificationDeliveryConfig();
  // SMTP path includes BETA-091 orchestration (queue/retry/status/fallback).
  return createNotificationAdapter(delivery.notifications, delivery.profile);
}

/**
 * BETA-091: Operator health snapshot for verification delivery.
 * Never includes credentials, tokens, or full recipient addresses.
 */
export async function getVerificationDeliveryHealth() {
  const { buildNotificationHealthReport } = await import("@/services/notifications/health");
  const { defaultVerificationMailQueue } = await import("@/services/notifications/queue");
  const delivery = await getVerificationDeliveryConfig();
  const queue = defaultVerificationMailQueue;
  return buildNotificationHealthReport({
    config: delivery.notifications,
    queueLagMs: queue.queueLagMs(),
    recentSendRate: queue.recentSendRate(),
    deadLetterCount: queue.deadLetterList(1_000).length,
  });
}
