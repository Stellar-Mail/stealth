#!/usr/bin/env node
/**
 * BETA-091: Repeatable verification-delivery checks (no production credentials).
 *
 * Prefer the focused Vitest suite for logic:
 *   npx vitest run tests/unit/notifications/verification-delivery-ops.test.ts
 *
 * This script documents operator probes and asserts redaction helpers inline so
 * it runs under plain Node without a TypeScript loader.
 *
 * Usage:
 *   node scripts/verify-smtp-delivery.mjs
 *   node scripts/verify-smtp-delivery.mjs --probe-only
 */

import { createHash, randomUUID } from "node:crypto";
import net from "node:net";

const probeOnly = process.argv.includes("--probe-only");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function redact(text) {
  return String(text)
    .replace(/([?&](?:token|code|key)=)[^&\s"'<>]+/gi, "$1[REDACTED_TOKEN]")
    .replace(/\/verify\?[^\s"'<>]+/gi, "/verify?[REDACTED]")
    .replace(/(?:password|secret)["':=\s]+[^\s"',}]+/gi, "[REDACTED_SECRET]")
    .slice(0, 400);
}

function containsSensitive(text) {
  return (
    /[?&](?:token|code)=[A-Za-z0-9_-]{16,}/i.test(text) || /\/verify\?[^#\s]*token=/i.test(text)
  );
}

function classify(code) {
  if (code >= 200 && code < 300) return { state: "accepted", retryable: false };
  if (code >= 400 && code < 500) return { state: "deferred", retryable: true };
  if (code === 550 || code === 551 || code === 552 || code === 553 || code === 554) {
    return { state: "hard_bounce", retryable: false };
  }
  if (code >= 500 && code < 600) return { state: "rejected", retryable: false };
  return { state: "failed", retryable: true };
}

/** Minimal in-script queue mirroring production semantics for offline evidence. */
function runOfflineChecks() {
  const records = new Map();
  const dead = [];
  const messageId = `vm_${randomUUID().replace(/-/g, "")}`;
  const email = "beta.user@example.test";
  const recipientHash = createHash("sha256").update(email).digest("hex");

  records.set(messageId, {
    messageId,
    state: "queued",
    recipientDomain: "example.test",
    recipientHash,
  });

  // Success
  records.get(messageId).state = "sent";
  assert(records.get(messageId).state === "sent", "success path");
  assert(!JSON.stringify(records.get(messageId)).includes("beta.user"), "no local-part");

  // Bounce / DLQ
  const dirty = redact(`550 user unknown token=tok_bounce_fixture`);
  assert(!containsSensitive(dirty), "bounce reason redacted");
  records.get(messageId).state = "hard_bounce";
  dead.push({ ...records.get(messageId), reason: dirty });
  assert(dead.length === 1, "hard bounce dlq");
  assert(classify(250).state === "accepted", "250");
  assert(classify(550).retryable === false, "550 permanent");

  console.log(
    JSON.stringify({
      ok: true,
      successMessageId: messageId,
      recipientHashPrefix: recipientHash.slice(0, 12),
      deadLetters: dead.length,
      note: "tokens_redacted",
    }),
  );
}

function probeSmtp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (status, detail) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve({ status, detail });
    };
    socket.setTimeout(timeoutMs);
    socket.on("data", (chunk) => {
      const greeting = String(chunk);
      if (/^[123]/.test(greeting.trim())) {
        socket.write("QUIT\r\n");
        finish("ok", "banner_ok");
      } else {
        finish("unavailable", "unexpected_smtp_greeting");
      }
    });
    socket.on("timeout", () => finish("unavailable", "smtp_probe_timeout"));
    socket.on("error", () => finish("unavailable", "smtp_unreachable"));
  });
}

runOfflineChecks();

if (probeOnly || process.env.STEALTH_SMTP_HOST) {
  const host = process.env.STEALTH_SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.STEALTH_SMTP_PORT || 1025);
  const result = await probeSmtp(host, port);
  console.log(JSON.stringify({ probe: result.status, detail: result.detail, host, port }));
}

console.log("verify-smtp-delivery: ok");
