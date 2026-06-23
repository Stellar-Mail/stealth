import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEFAULT_LIMITS,
  evaluateProcessingBudget,
  normalizeTicketCandidate,
  sanitizeText,
  validateMailEnvelope,
} from "../guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-mails.json");

async function loadFixtures() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

test("validateMailEnvelope returns structured errors for malformed input", () => {
  const errors = validateMailEnvelope({
    id: "",
    from: "not-an-email",
    subject: "",
    body: "",
    attachments: "bad",
    thread: "bad"
  });

  assert.deepEqual(errors, [
    "id is required",
    "from must be an email address",
    "subject is required",
    "body is required",
    "attachments must be an array when provided",
    "thread must be an array when provided"
  ]);
});

test("sanitizeText removes HTML, script blocks, control characters, and secret values", () => {
  const result = sanitizeText(
    "password=super-secret \u0000 <script>steal()</script><b>Hello</b> Bearer abc.def.ghi",
    200
  );

  assert.equal(result.value, "password=[REDACTED] Hello Bearer [REDACTED]");
  assert.equal(result.truncated, false);
});

test("normalizeTicketCandidate creates a safe ticket candidate for normal mail", async () => {
  const { safeEmail } = await loadFixtures();
  const result = normalizeTicketCandidate(safeEmail);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ticket.sourceMailId, "mail-001");
  assert.equal(result.ticket.requester, "ops@example.com");
  assert.equal(result.ticket.title, "Cannot access team mailbox");
  assert.equal(result.ticket.attachments.length, 1);
  assert.equal(result.ticket.attachments[0].skipped, false);
});

test("normalizeTicketCandidate accepts mail without optional attachments or thread", () => {
  const result = normalizeTicketCandidate({
    id: "mail-minimal",
    from: "team@example.com",
    subject: "Minimal message",
    body: "Please create a ticket."
  });

  assert.equal(result.ok, true);
  assert.equal(result.ticket.attachments.length, 0);
  assert.equal(result.ticket.threadPreview.length, 0);
  assert.deepEqual(result.warnings, []);
});

test("normalizeTicketCandidate sanitizes hostile mail before ticket generation", async () => {
  const { hostileEmail } = await loadFixtures();
  const result = normalizeTicketCandidate(hostileEmail);

  assert.equal(result.ok, true);
  assert.equal(result.ticket.title, "Urgent password reset");
  assert.match(result.ticket.description, /password=\[REDACTED\]/);
  assert.match(result.ticket.description, /Bearer \[REDACTED\]/);
  assert.doesNotMatch(result.ticket.description, /<script>/);
  assert.doesNotMatch(result.ticket.description, /super-secret/);
  assert.equal(result.ticket.attachments[0].skipped, true);
  assert.ok(result.warnings.includes("large-attachment-skipped"));
});

test("evaluateProcessingBudget flags attachment and thread work before expensive processing", () => {
  const thread = Array.from({ length: DEFAULT_LIMITS.maxThreadItems + 3 }, (_, index) => ({
    from: "archive@example.com",
    body: `Thread item ${index}`
  }));
  const raw = {
    body: "x".repeat(DEFAULT_LIMITS.maxBodyChars + 1),
    attachments: Array.from({ length: DEFAULT_LIMITS.maxAttachmentCount + 1 }, (_, index) => ({
      filename: `archive-${index}.zip`,
      sizeBytes: DEFAULT_LIMITS.maxAttachmentBytes + 1
    })),
    thread
  };

  const budget = evaluateProcessingBudget(raw);

  assert.ok(budget.warnings.includes("body-truncated"));
  assert.ok(budget.warnings.includes("attachment-count-capped"));
  assert.ok(budget.warnings.includes("attachment-total-size-exceeded"));
  assert.ok(budget.warnings.includes("large-attachment-skipped"));
  assert.ok(budget.warnings.includes("thread-capped"));
  assert.equal(budget.safeAttachmentLimit, DEFAULT_LIMITS.maxAttachmentCount);
  assert.equal(budget.safeThreadLimit, DEFAULT_LIMITS.maxThreadItems);
});

test("normalizeTicketCandidate caps attachment and thread output", async () => {
  const { largeEmail } = await loadFixtures();
  const result = normalizeTicketCandidate({
    ...largeEmail,
    thread: Array.from({ length: DEFAULT_LIMITS.maxThreadItems + 10 }, (_, index) => ({
      from: "archive@example.com",
      body: `Thread item ${index}`
    }))
  });

  assert.equal(result.ok, true);
  assert.equal(result.ticket.attachments.length, DEFAULT_LIMITS.maxAttachmentCount);
  assert.equal(result.ticket.threadPreview.length, DEFAULT_LIMITS.maxThreadItems);
  assert.ok(result.warnings.includes("attachment-count-capped"));
  assert.ok(result.warnings.includes("thread-capped"));
});
