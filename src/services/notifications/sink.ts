import type { DeliveryReceipt, NotificationAdapter, VerificationEmailMessage } from "./adapter";

/**
 * BETA-005: Local-development capture sink.
 *
 * Captures verification messages in memory instead of sending them over the
 * network. This is the default transport for development/preview profiles and
 * MUST NOT be selected in the production path — the production transport
 * defaults to SMTP and the adapter factory refuses to construct a sink in
 * production.
 *
 * The captured messages are visible to tests and local tooling only; the
 * buffer is never persisted and is cleared on `clear()`.
 */
export class SinkNotificationAdapter implements NotificationAdapter {
  readonly transport = "sink" as const;

  private readonly messages: VerificationEmailMessage[] = [];

  constructor(private readonly maxBuffered: number = 1000) {}

  async deliverVerificationEmail(message: VerificationEmailMessage): Promise<DeliveryReceipt> {
    if (this.messages.length >= this.maxBuffered) {
      this.messages.shift();
    }
    this.messages.push({ ...message, expiresAt: new Date(message.expiresAt) });
    return {
      transport: "sink",
      accepted: true,
      providerRef: `sink-${this.messages.length}`,
      safeTargetReference: await sha256Reference(message.to),
    };
  }

  /** Messages captured so far, oldest first. Never persisted. */
  get capturedMessages(): readonly VerificationEmailMessage[] {
    return this.messages.map((message) => ({
      ...message,
      expiresAt: new Date(message.expiresAt),
    }));
  }

  /** Most recently captured message, if any. */
  get latestMessage(): VerificationEmailMessage | null {
    const latest = this.messages.at(-1);
    return latest ? { ...latest, expiresAt: new Date(latest.expiresAt) } : null;
  }

  get size(): number {
    return this.messages.length;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

async function sha256Reference(value: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return `ref:${value}`;
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}
