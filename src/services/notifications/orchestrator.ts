import type { ConfigProfile, NotificationsConfig } from "@/config/schema";
import type { DeliveryReceipt, NotificationAdapter, VerificationEmailMessage } from "./adapter";
import { SmtpError, SmtpNotificationAdapter } from "./smtp";
import {
  defaultVerificationMailQueue,
  type DeliveryRecord,
  type VerificationMailQueue,
} from "./queue";
import { SinkNotificationAdapter } from "./sink";
import { redactNotificationText } from "./redaction";
import { classifySmtpReplyCode } from "./delivery-status";

function buildBaseAdapter(
  config: NotificationsConfig,
  profile: ConfigProfile,
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
 * BETA-091: Orchestrates adapter delivery with queue, retry, and redacted status.
 *
 * The plaintext token exists only inside `message` for the duration of active
 * delivery/retry attempts. On terminal outcomes the queue purges the send
 * callback so secrets do not linger in the process-wide map.
 */

export interface OrchestratedDeliveryReceipt extends DeliveryReceipt {
  messageId: string;
  deliveryState: DeliveryRecord["state"];
  reasonClass: DeliveryRecord["reasonClass"];
}

export class OrchestratedNotificationAdapter implements NotificationAdapter {
  readonly transport: NotificationAdapter["transport"];

  constructor(
    private readonly inner: NotificationAdapter,
    private readonly queue: VerificationMailQueue = defaultVerificationMailQueue,
  ) {
    this.transport = inner.transport;
  }

  async deliverVerificationEmail(
    message: VerificationEmailMessage,
  ): Promise<OrchestratedDeliveryReceipt> {
    const purpose = message.purpose === "password_reset" ? "password_reset" : "email_verification";

    // Local send closure — retained by the queue only while the message remains
    // retryable. Terminal success/DLQ purges it (see VerificationMailQueue).
    const send = async () => {
      try {
        const receipt = await this.inner.deliverVerificationEmail(message);
        return {
          accepted: receipt.accepted,
          providerRef: receipt.providerRef,
        };
      } catch (error) {
        if (error instanceof SmtpError) {
          return {
            accepted: false,
            smtpCode: error.replyCode,
            error,
          };
        }
        return { accepted: false, error };
      }
    };

    const record = this.queue.enqueue(
      {
        purpose,
        recipientEmail: message.to,
      },
      send,
    );

    const processed = await this.queue.attempt(record.messageId, send);
    const accepted =
      processed.state === "sent" ||
      processed.state === "accepted" ||
      processed.state === "delivered";

    return {
      transport: this.transport,
      accepted,
      providerRef: processed.providerEventId ?? processed.messageId,
      safeTargetReference: processed.recipientHash,
      messageId: processed.messageId,
      deliveryState: processed.state,
      reasonClass: processed.reasonClass,
    };
  }

  getQueue(): VerificationMailQueue {
    return this.queue;
  }
}

/**
 * BETA-091: When SMTP is selected but unavailable in non-production profiles,
 * fall back to the development capture sink so beta invite / local signup
 * flows remain exercisable without a paid vendor. Production never falls back.
 */
export class InviteFallbackNotificationAdapter implements NotificationAdapter {
  readonly transport: NotificationAdapter["transport"];
  private readonly sink = new SinkNotificationAdapter();
  private fellBack = false;

  constructor(
    private readonly primary: NotificationAdapter,
    private readonly profile: ConfigProfile,
  ) {
    this.transport = primary.transport;
  }

  didFallBack(): boolean {
    return this.fellBack;
  }

  getCaptureSink(): SinkNotificationAdapter {
    return this.sink;
  }

  async deliverVerificationEmail(message: VerificationEmailMessage): Promise<DeliveryReceipt> {
    try {
      return await this.primary.deliverVerificationEmail(message);
    } catch (error) {
      if (this.profile === "production") {
        throw error;
      }
      this.fellBack = true;
      // Capture locally for operators; never rethrow secrets.
      void redactNotificationText(error);
      const receipt = await this.sink.deliverVerificationEmail(message);
      return {
        ...receipt,
        providerRef: `invite_fallback:${receipt.providerRef ?? "sink"}`,
      };
    }
  }
}

/**
 * Builds the production delivery stack: configured adapter → optional invite
 * fallback (non-prod) → orchestration (queue / status / redaction).
 */
export function createOrchestratedNotificationAdapter(
  config: NotificationsConfig,
  profile: ConfigProfile = "development",
  queue: VerificationMailQueue = defaultVerificationMailQueue,
): OrchestratedNotificationAdapter {
  const base = buildBaseAdapter(config, profile);
  const withFallback =
    profile === "production" || config.transport === "sink"
      ? base
      : new InviteFallbackNotificationAdapter(base, profile);
  return new OrchestratedNotificationAdapter(withFallback, queue);
}

/** Map an SMTP failure into a safe reason class for audit logs. */
export function safeDeliveryFailureClass(error: unknown): string {
  if (error instanceof SmtpError && typeof error.replyCode === "number") {
    return classifySmtpReplyCode(error.replyCode).reasonClass;
  }
  return redactNotificationText(error).slice(0, 80) || "unknown";
}
