import type { ConfigProfile, NotificationsConfig } from "@/config/schema";
import type { NotificationAdapter } from "./adapter";
import { SinkNotificationAdapter } from "./sink";
import { SmtpNotificationAdapter } from "./smtp";

export * from "./adapter";
export * from "./sink";
export * from "./smtp";

/**
 * BETA-005: Creates the notification adapter selected by runtime config.
 *
 * - "sink" — local-development capture; hard-refused in the production path.
 * - "smtp" — self-hosted SMTP delivery.
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

  return new SmtpNotificationAdapter({
    ...config.smtp,
    fromAddress: config.fromAddress,
  });
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
