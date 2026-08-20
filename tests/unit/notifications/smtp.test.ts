import { describe, expect, it, vi } from "vitest";

import type { VerificationEmailMessage } from "../../../src/services/notifications/adapter";
import {
  SmtpError,
  SmtpNotificationAdapter,
  type SmtpSocketLike,
} from "../../../src/services/notifications/smtp";

/**
 * Scripted SMTP server: replies to each line the client writes. The greeting
 * is delivered asynchronously so the client's data listener is always wired
 * before the first reply arrives.
 */
class ScriptedSmtpServer implements SmtpSocketLike {
  readonly written: string[] = [];
  ended = false;
  destroyed = false;

  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(
    private readonly greetWith: string,
    private readonly respond: (line: string) => string | null,
  ) {
    if (greetWith) {
      setTimeout(() => this.emit("data", greetWith), 0);
    }
  }

  on(event: string, listener: (...args: unknown[]) => void) {
    const bucket = this.listeners.get(event) ?? [];
    bucket.push(listener);
    this.listeners.set(event, bucket);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void) {
    const bucket = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      bucket.filter((candidate) => candidate !== listener),
    );
    return this;
  }

  write(data: string) {
    this.written.push(data);
    const rawLine = data.endsWith("\r\n") ? data.slice(0, -2) : data;
    const reply = this.respond(rawLine);
    if (reply !== null) {
      queueMicrotask(() => this.emit("data", reply));
    }
  }

  end() {
    this.ended = true;
  }

  destroy() {
    this.destroyed = true;
  }

  setTimeout() {
    return this;
  }

  startTls?: () => void = undefined;

  private emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}

const smtpOptions = {
  host: "smtp.test",
  port: 2525,
  secure: false,
  startTls: false,
  username: undefined,
  password: undefined,
  fromAddress: "no-reply@stealth.mail",
  timeoutMs: 1000,
};

const message: VerificationEmailMessage = {
  to: "alice@stealth.mail",
  purpose: "email_verification",
  verificationUrl: "https://stealth.mail/verify?email=alice%40stealth.mail&token=secret-token",
  expiresAt: new Date("2026-02-01T00:00:00.000Z"),
};

const fullConversation = (line: string): string | null => {
  switch (line) {
    case "EHLO stealth.mail":
      return "250-stealth.test\r\n250 AUTH PLAIN\r\n";
    case "MAIL FROM:<no-reply@stealth.mail>":
      return "250 2.1.0 Ok\r\n";
    case "RCPT TO:<alice@stealth.mail>":
      return "250 2.1.5 Ok\r\n";
    case "DATA":
      return "354 End data with <CR><LF>.<CR><LF>\r\n";
    case "QUIT":
      return "221 2.0.0 Bye\r\n";
    default:
      // The DATA payload is one write terminating with a bare "." line.
      return line.endsWith(".") ? "250 2.0.0 Ok: queued as 12345\r\n" : null;
  }
};

describe("BETA-005: SmtpNotificationAdapter (scripted conversations)", () => {
  it("delivers the verification email over a full SMTP session", async () => {
    const server = new ScriptedSmtpServer("220 smtp.test ESMTP ready\r\n", fullConversation);
    const adapter = new SmtpNotificationAdapter({
      ...smtpOptions,
      socketFactory: async () => server,
    });

    const receipt = await adapter.deliverVerificationEmail(message);

    expect(receipt).toMatchObject({ transport: "smtp", accepted: true });
    expect(receipt.providerRef).toMatch(/^<[0-9a-f-]+@stealth\.mail>$/);
    expect(receipt.safeTargetReference).toMatch(/^[a-f0-9]{64}$/);

    const conversation = server.written.join("").split("\r\n");
    expect(conversation[0]).toBe("EHLO stealth.mail");
    expect(conversation[1]).toBe("MAIL FROM:<no-reply@stealth.mail>");
    expect(conversation[2]).toBe("RCPT TO:<alice@stealth.mail>");
    expect(conversation[3]).toBe("DATA");
    expect(server.written.join("")).toContain("https://stealth.mail/verify?");
    expect(server.written.join("")).toContain("\r\n.\r\n");
    expect(server.ended).toBe(true);
  });

  it("performs STARTTLS and re-EHLO before AUTH when configured", async () => {
    const server = new ScriptedSmtpServer("220 smtp.test ESMTP ready\r\n", (line) => {
      if (line === "EHLO stealth.mail") return "250-STARTTLS\r\n250 AUTH PLAIN\r\n";
      if (line === "STARTTLS") return "220 2.0.0 Ready to start TLS\r\n";
      if (line.startsWith("AUTH PLAIN ")) return "235 2.7.0 Authentication successful\r\n";
      return fullConversation(line);
    });
    server.startTls = vi.fn(() => undefined) as never;

    const adapter = new SmtpNotificationAdapter({
      ...smtpOptions,
      startTls: true,
      username: "smtp-user",
      password: "smtp-pass",
      socketFactory: async () => server,
    });

    const receipt = await adapter.deliverVerificationEmail(message);
    expect(receipt.accepted).toBe(true);

    const expectedAuth = Buffer.from(`\u0000smtp-user\u0000smtp-pass`, "utf8").toString("base64");
    const commands = server.written
      .map((chunk) => chunk.split("\r\n")[0])
      .filter((line) => /^(EHLO|STARTTLS|AUTH|MAIL FROM|RCPT TO|DATA|QUIT)/.test(line));
    expect(commands).toEqual([
      "EHLO stealth.mail",
      "STARTTLS",
      "EHLO stealth.mail",
      `AUTH PLAIN ${expectedAuth}`,
      "MAIL FROM:<no-reply@stealth.mail>",
      "RCPT TO:<alice@stealth.mail>",
      "DATA",
      "QUIT",
    ]);
    expect(server.startTls).toHaveBeenCalledOnce();
  });

  it("rejects an SMTP failure with the reply code and never the payload", async () => {
    const server = new ScriptedSmtpServer("220 smtp.test ESMTP ready\r\n", (line) => {
      if (line.startsWith("RCPT TO:")) return "550 5.1.1 <alice@stealth.mail> unknown mailbox\r\n";
      return fullConversation(line);
    });
    const adapter = new SmtpNotificationAdapter({
      ...smtpOptions,
      socketFactory: async () => server,
    });

    await expect(adapter.deliverVerificationEmail(message)).rejects.toMatchObject({
      name: "SmtpError",
      code: "smtp_delivery_failed",
      retryable: true,
      command: "RCPT TO",
      replyCode: 550,
    });

    // The failure surface carries the reply code only — never the payload.
    const captured = (await adapter
      .deliverVerificationEmail(message)
      .then(() => null)
      .catch((error: unknown) => error as SmtpError))!;
    expect(JSON.stringify(captured)).not.toContain("secret-token");
    expect(JSON.stringify(captured)).not.toContain("alice@stealth.mail");
  });

  it("fails when the server never greets (timeout)", async () => {
    const server = new ScriptedSmtpServer("", () => null);
    const adapter = new SmtpNotificationAdapter({
      ...smtpOptions,
      timeoutMs: 20,
      socketFactory: async () => server,
    });

    await expect(adapter.deliverVerificationEmail(message)).rejects.toMatchObject({
      name: "SmtpError",
      command: "connect",
    });
  });
});
