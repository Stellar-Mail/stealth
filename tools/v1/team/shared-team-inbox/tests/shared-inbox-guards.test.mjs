import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  SHARED_INBOX_LIMITS,
  SharedInboxGuardError,
  buildSharedInboxQueue,
  normalizeEmailAddress,
  normalizeSharedInboxMessage,
  prepareInternalCommentDraft,
  prepareReplyDraft,
  sanitizeText,
  shouldDeferAttachmentPreview,
} from "../services/shared-inbox-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../fixtures/sample-guard-inputs.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

test("sanitizes control characters and truncates bounded text", () => {
  assert.equal(sanitizeText("  hello\u0000 world  ", "subject"), "hello world");
  assert.equal(sanitizeText("abcdef", "preview", { maxLength: 4 }), "abc…");
});

test("rejects malformed email-like addresses", () => {
  assert.throws(() => normalizeEmailAddress("not-an-address", "senderAddress"), SharedInboxGuardError);
});

test("normalizes shared inbox message input", () => {
  const normalized = normalizeSharedInboxMessage(fixture.messages[0]);

  assert.equal(normalized.senderAddress, "customer.one@example.test");
  assert.equal(normalized.sharedInboxAddress, "support@team.test");
  assert.equal(normalized.status, "unassigned");
  assert.equal(normalized.receivedAt, "2026-06-23T10:10:00.000Z");
});

test("rejects unsupported message status", () => {
  assert.throws(
    () => normalizeSharedInboxMessage({ ...fixture.messages[0], status: "archived" }),
    SharedInboxGuardError,
  );
});

test("builds newest-first queue after validation", () => {
  const queue = buildSharedInboxQueue(fixture.messages);

  assert.deepEqual(
    queue.map((message) => message.id),
    ["msg-newer-001", "msg-older-002"],
  );
});

test("rejects oversized message batches before normalizing", () => {
  assert.throws(
    () => buildSharedInboxQueue(fixture.messages, { maxMessagesPerBatch: 1 }),
    SharedInboxGuardError,
  );
});

test("prepares internal comments as team-only drafts", () => {
  const draft = prepareInternalCommentDraft(fixture.commentDraft);

  assert.equal(draft.visibility, "team-only");
  assert.equal(draft.authorAddress, "alice@team.test");
  assert.equal(draft.body, "Known receipt issue. Keep the note internal.");
});

test("prepares explicit shared-inbox reply drafts", () => {
  const draft = prepareReplyDraft(fixture.replyDraft);

  assert.equal(draft.fromSharedInboxAddress, "support@team.test");
  assert.equal(draft.toAddress, "customer.one@example.test");
  assert.equal(draft.subject, "Re: Cannot open encrypted message");
});

test("truncates oversized comments and replies", () => {
  const longComment = "a".repeat(SHARED_INBOX_LIMITS.maxCommentLength + 50);
  const longReply = "b".repeat(SHARED_INBOX_LIMITS.maxReplyLength + 50);

  assert.equal(
    prepareInternalCommentDraft({ ...fixture.commentDraft, body: longComment }).body.length,
    SHARED_INBOX_LIMITS.maxCommentLength,
  );
  assert.equal(
    prepareReplyDraft({ ...fixture.replyDraft, body: longReply }).body.length,
    SHARED_INBOX_LIMITS.maxReplyLength,
  );
});

test("defers large attachment previews", () => {
  assert.equal(shouldDeferAttachmentPreview(fixture.attachments), false);
  assert.equal(
    shouldDeferAttachmentPreview([
      { filename: "large.bin", sizeBytes: SHARED_INBOX_LIMITS.maxAttachmentBytesForPreview + 1 },
    ]),
    true,
  );
});

test("fixture stays synthetic and avoids sensitive fields", async () => {
  const fixtureText = await readFile(fixturePath, "utf8");

  assert.equal(
    fixture.messages.every((message) => message.senderAddress.toLowerCase().endsWith(".test")),
    true,
  );
  assert.doesNotMatch(fixtureText, /password|secret|token|bank|card|wallet|seed/i);
});
