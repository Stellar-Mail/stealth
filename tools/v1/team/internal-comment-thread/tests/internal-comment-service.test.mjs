import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMENT_LIMITS,
  InternalCommentError,
  createInternalCommentService,
  normalizeCommentTarget,
  normalizeTeamAddress,
  sanitizeCommentText,
} from "../index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../fixtures/sample-comments.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

function createService() {
  return createInternalCommentService({
    teamRoster: fixture.teamRoster,
    now: () => "2026-06-23T10:00:00.000Z",
  });
}

test("sanitizes comment text and bounds body length", () => {
  assert.equal(sanitizeCommentText("  hello\u0000 team  ", "body"), "hello team");
  assert.equal(sanitizeCommentText("abcdef", "body", { maxLength: 4 }), "abc…");
});

test("normalizes team addresses and comment targets", () => {
  assert.equal(normalizeTeamAddress("Alice@Team.Test", "author"), "alice@team.test");
  assert.deepEqual(normalizeCommentTarget({ kind: "message", id: " msg-1 " }), {
    kind: "message",
    id: "msg-1",
  });
});

test("rejects unsupported target kinds and unauthorized authors", () => {
  const service = createService();

  assert.throws(
    () => normalizeCommentTarget({ kind: "conversation", id: "x" }),
    InternalCommentError,
  );
  assert.throws(
    () => service.addComment({ ...fixture.comments[0], author: "eve@example.test" }),
    InternalCommentError,
  );
});

test("adds and lists message comments in chronological order", () => {
  const service = createService();

  service.addComment(fixture.comments[1]);
  service.addComment(fixture.comments[0]);
  const comments = service.listComments(fixture.messageTarget);

  assert.deepEqual(
    comments.map((comment) => comment.id),
    ["comment-001", "comment-002"],
  );
  assert.equal(comments[0].visibility, "team-only");
});

test("keeps message and thread targets isolated", () => {
  const service = createService();

  for (const comment of fixture.comments) {
    service.addComment(comment);
  }

  assert.deepEqual(
    service.listComments(fixture.messageTarget).map((comment) => comment.id),
    ["comment-001", "comment-002"],
  );
  assert.deepEqual(
    service.listComments(fixture.threadTarget).map((comment) => comment.id),
    ["comment-003"],
  );
});

test("allows authors to update their own comments", () => {
  const service = createService();
  service.addComment(fixture.comments[0]);

  const updated = service.updateComment("comment-001", "Updated internal note", "alice@team.test");

  assert.equal(updated.body, "Updated internal note");
  assert.equal(updated.updatedAt, "2026-06-23T10:00:00.000Z");
});

test("rejects update and delete attempts from other team members", () => {
  const service = createService();
  service.addComment(fixture.comments[0]);

  assert.throws(
    () => service.updateComment("comment-001", "Changed by Bob", "bob@team.test"),
    InternalCommentError,
  );
  assert.throws(() => service.deleteComment("comment-001", "bob@team.test"), InternalCommentError);
});

test("soft-deletes author comments and omits them from regular lists", () => {
  const service = createService();
  service.addComment(fixture.comments[0]);
  service.deleteComment("comment-001", "alice@team.test");

  assert.deepEqual(service.listComments(fixture.messageTarget), []);
});

test("external-safe summary never includes comment body text", () => {
  const service = createService();
  service.addComment(fixture.comments[0]);
  const summary = service.buildExternalSafeSummary(fixture.messageTarget);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.internalCommentCount, 1);
  assert.equal(summary.commentBodiesIncluded, false);
  assert.doesNotMatch(serialized, /old support case|Keep this note internal/);
});

test("rejects empty and oversized comments", () => {
  const service = createService();

  assert.throws(
    () => service.addComment({ ...fixture.comments[0], body: "   " }),
    InternalCommentError,
  );

  const longBody = "a".repeat(COMMENT_LIMITS.maxBodyLength + 10);
  const comment = service.addComment({ ...fixture.comments[0], body: longBody });
  assert.equal(comment.body.length, COMMENT_LIMITS.maxBodyLength);
});

test("fixture stays synthetic and avoids sensitive fields", async () => {
  const fixtureText = await readFile(fixturePath, "utf8");

  assert.equal(fixture.teamRoster.every((address) => address.endsWith(".test")), true);
  assert.equal(fixture.externalSenderAddress.endsWith(".test"), true);
  assert.doesNotMatch(fixtureText, /password|secret|token|bank|card|wallet|seed/i);
});
