import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createMailTicketBatchPlan,
  guardMailTicketBatch,
  mailTicketGuardDefaults,
  sanitizeMailTicketDraft,
} from "../services/ticket-draft-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const toolDir = join(currentDir, "..");
const fixturePath = join(toolDir, "fixtures", "hostile-ticket-inputs.json");
const securityDocPath = join(toolDir, "docs", "security-and-performance.md");
const performanceDocPath = join(toolDir, "docs", "performance-notes.md");

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

test("fixture cases document hostile mail-to-ticket inputs", async () => {
  const fixture = await readJson(fixturePath);

  assert.equal(fixture.tool, "mail-to-ticket-converter");
  assert.ok(fixture.cases.length >= 3);

  for (const item of fixture.cases) {
    assert.ok(item.name);
    assert.ok(item.input);
    assert.ok(item.expectedWarnings || item.expectedErrors);
  }
});

test("sanitizes active content and flags secret-like or tracking content", async () => {
  const fixture = await readJson(fixturePath);
  const scriptCase = fixture.cases.find((item) => item.name === "script and secret-like body");
  const result = sanitizeMailTicketDraft(scriptCase.input);

  assert.equal(result.ok, true);
  assert.equal(result.value.sender, "customer@example.com");
  assert.ok(!result.value.subject.includes("<"));
  assert.ok(!result.value.body.includes(">"));

  for (const expected of scriptCase.expectedWarnings) {
    assert.ok(result.warnings.includes(expected), `${expected} warning is missing`);
  }
});

test("rejects malformed required fields before conversion", async () => {
  const fixture = await readJson(fixturePath);
  const invalidSenderCase = fixture.cases.find((item) => item.name === "invalid sender");
  const result = sanitizeMailTicketDraft(invalidSenderCase.input);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["invalid_sender"]);
  assert.equal(result.value, undefined);
});

test("bounds attachment metadata and flags risky attachments", async () => {
  const fixture = await readJson(fixturePath);
  const attachmentCase = fixture.cases.find(
    (item) => item.name === "oversized and risky attachments",
  );
  const result = sanitizeMailTicketDraft(attachmentCase.input);

  assert.equal(result.ok, true);
  assert.equal(result.value.attachments.length, 2);
  assert.equal(result.value.attachments[1].byteSize, mailTicketGuardDefaults.maxAttachmentBytes);
  assert.ok(result.value.attachments[1].flags.includes("risky_extension"));
  assert.ok(result.value.attachments[1].flags.includes("oversized_attachment"));

  for (const expected of attachmentCase.expectedWarnings) {
    assert.ok(result.warnings.includes(expected), `${expected} warning is missing`);
  }
});

test("caps large batches before validating drafts", () => {
  const baseDraft = {
    subject: "Need support",
    body: "Please convert this message into a ticket.",
    sender: "sender@example.com",
  };
  const drafts = Array.from({ length: 12 }, (_, index) => ({ ...baseDraft, id: `draft-${index}` }));
  const plan = createMailTicketBatchPlan(drafts, { limits: { maxBatchSize: 5 } });
  const result = guardMailTicketBatch(drafts, { limits: { maxBatchSize: 5 } });

  assert.equal(plan.sourceCount, 12);
  assert.equal(plan.items.length, 5);
  assert.equal(plan.skippedCount, 7);
  assert.equal(result.accepted.length, 5);
  assert.equal(result.rejected.length, 0);
});

test("security and performance docs describe the isolated guard boundary", async () => {
  const [securityDoc, performanceDoc] = await Promise.all([
    readFile(securityDocPath, "utf8"),
    readFile(performanceDocPath, "utf8"),
  ]);

  assert.ok(securityDoc.includes("Threat Assumptions"));
  assert.ok(securityDoc.includes("No ticket creation or update"));
  assert.ok(securityDoc.includes("No main application integration"));
  assert.ok(performanceDoc.includes("Bounded Work"));
  assert.ok(performanceDoc.includes("Attachment contents are not read or decoded"));
});
