import type { NotificationsConfig } from "@/config/schema";
import type { SmtpSocketFactory, SmtpSocketLike } from "./smtp";

/**
 * BETA-091: Transport / queue / rate health probes for self-hosted delivery.
 * Probes never log credentials or full SMTP transcripts.
 */

export type NotificationHealthStatus = "ok" | "degraded" | "unavailable" | "skipped";

export interface NotificationHealthReport {
  transport: NotificationHealthStatus;
  queueLagMs: number;
  recentSendRate: { windowSeconds: number; count: number };
  deadLetterCount: number;
  detail: string;
}

export interface SmtpProbeOptions {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  timeoutMs?: number;
  connect?: SmtpSocketFactory;
}

/**
 * Lightweight SMTP banner probe: connect, read greeting, QUIT.
 * Does not AUTH — confirms reachability without presenting credentials.
 */
export async function probeSmtpTransport(
  options: SmtpProbeOptions,
): Promise<{ status: NotificationHealthStatus; detail: string }> {
  const timeoutMs = options.timeoutMs ?? 3_000;
  const connect = options.connect ?? defaultProbeConnect;

  let socket: SmtpSocketLike | undefined;
  try {
    socket = await connect({
      host: options.host,
      port: options.port,
      secure: options.secure,
    });
    socket.setTimeout(timeoutMs);

    const greeting = await readOnce(socket, timeoutMs);
    if (!/^[123]/.test(greeting.trim())) {
      return { status: "unavailable", detail: "unexpected_smtp_greeting" };
    }

    socket.write("QUIT\r\n");
    return {
      status: "ok",
      detail: options.startTls && !options.secure ? "banner_ok_starttls_expected" : "banner_ok",
    };
  } catch {
    return { status: "unavailable", detail: "smtp_unreachable" };
  } finally {
    try {
      socket?.destroy();
    } catch {
      // ignore
    }
  }
}

async function defaultProbeConnect(options: {
  host: string;
  port: number;
  secure: boolean;
}): Promise<SmtpSocketLike> {
  const net = await import("node:net");
  const tls = await import("node:tls");
  return new Promise((resolve, reject) => {
    const socket = options.secure
      ? tls.connect({
          host: options.host,
          port: options.port,
          servername: options.host,
          rejectUnauthorized: true,
        })
      : net.connect({ host: options.host, port: options.port });
    socket.once("error", reject);
    socket.once("connect", () => resolve(socket as unknown as SmtpSocketLike));
  });
}

function readOnce(socket: SmtpSocketLike, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("smtp_probe_timeout")), timeoutMs);
    const onData = (...args: unknown[]) => {
      clearTimeout(timer);
      socket.off?.("data", onData);
      resolve(String(args[0] ?? ""));
    };
    socket.on("data", onData);
    socket.on("error", (err: unknown) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function buildNotificationHealthReport(input: {
  config: NotificationsConfig;
  queueLagMs: number;
  recentSendRate: { windowSeconds: number; count: number };
  deadLetterCount: number;
  probe?: typeof probeSmtpTransport;
}): Promise<NotificationHealthReport> {
  if (input.config.transport === "sink") {
    return {
      transport: "skipped",
      queueLagMs: input.queueLagMs,
      recentSendRate: input.recentSendRate,
      deadLetterCount: input.deadLetterCount,
      detail: "sink_capture_active",
    };
  }

  const probe = input.probe ?? probeSmtpTransport;
  const result = await probe({
    host: input.config.smtp.host,
    port: input.config.smtp.port,
    secure: input.config.smtp.secure,
    startTls: input.config.smtp.startTls,
  });

  const degraded =
    result.status === "ok" && (input.queueLagMs > 30_000 || input.deadLetterCount > 0);

  return {
    transport: degraded ? "degraded" : result.status,
    queueLagMs: input.queueLagMs,
    recentSendRate: input.recentSendRate,
    deadLetterCount: input.deadLetterCount,
    detail: result.detail,
  };
}
