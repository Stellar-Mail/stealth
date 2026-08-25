import type { ConfigProfile, NotificationsConfig } from "@/config/schema";
import type { NotificationAdapter } from "./adapter";
import { SinkNotificationAdapter } from "./sink";
import { SmtpNotificationAdapter } from "./smtp";
import { createOrchestratedNotificationAdapter } from "./orchestrator";
import { defaultVerificationMailQueue } from "./queue";

export * from "./adapter";
export * from "./sink";
export * from "./smtp";
export * from "./delivery-status";
export * from "./redaction";
export * from "./queue";
export * from "./health";
export * from "./orchestrator";
export * from "./worker";

/**
 * BETA-005 / BETA-091: Creates the notification adapter selected by runtime config.
 *
 * - "sink" — local-development capture; hard-refused in the production path.
 * - "smtp" — self-hosted SMTP delivery with queue, retry, and status (BETA-091).
 *
 * Misconfiguration fails fast at construction time (never silently falls back
 * to a demo transport), so a production deployment cannot accidentally send
 * verification messages through the dev sink.
 */
export function createNotificationAdapter(
  config: NotificationsConfig,
  profile: ConfigProfile = "development",
): NotificationAdapter {
  if (config.transport === "sink") {
    if (profile === "production") {
      throw new Error(
        "Configuration error: the 'sink' notification transport must never be selected in production.",
      );
    }
    return new SinkNotificationAdapter();
  }

  if (config.smtp.host === "smtp.invalid" || config.smtp.host.trim().length === 0) {
    throw new Error(
      "Configuration error: STEALTH_SMTP_HOST must point at a self-hosted SMTP server.",
    );
  }

  // Production SMTP path always runs through the orchestrator so delivery
  // states, retries, and redacted observability stay on by default.
  return createOrchestratedNotificationAdapter(config, profile, defaultVerificationMailQueue);
}

/**
 * True when the selected transport is safe for the given profile. The dev
 * capture sink is never allowed in production.
 */
export function isNotificationTransportAllowed(
  transport: NotificationsConfig["transport"],
  profile: ConfigProfile,
): boolean {
  return !(profile === "production" && transport === "sink");
}

/** Raw SMTP adapter without orchestration — used by focused protocol tests. */
export function createRawSmtpAdapter(config: NotificationsConfig): SmtpNotificationAdapter {
  return new SmtpNotificationAdapter({
    ...config.smtp,
    fromAddress: config.fromAddress,
  });
}
