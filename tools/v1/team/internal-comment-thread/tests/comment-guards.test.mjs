import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  InternalCommentGuardError,
  LIMITS,
  assertExternalPayloadDoesNotLeakComment,
  buildExternalReplyPayload,
  guardCommentHistory,
  guardTeamRoster,
  sanitizeCommentBody,
  validateAuthor,
  validateCommentBody,
  validateCommentInput,
  validateTarget,
} from "../guards/comment-guards.mjs";

const currentDir = join(fileURLToPath(import.meta.url), "..");
const fixture = JSON.parse(
  readFileSync(join(currentDir, "..", "fixtures", "comment-guard-fixtures.json"), "utf8"),
);

describe("validateTarget", () => {
  it("accepts message and thread targets", () => {
    assert.deepEqual(validateTarget({ kind: "message", id: "msg-001" }), {
      kind: "message",
      id: "msg-001",
    });
    assert.deepEqual(validateTarget({ kind: "thread", id: "thread_002" }), {
      kind: "thread",
      id: "thread_002",
    });
  });

  it("rejects unsafe target values", () => {
    assert.throws(() => validateTarget(null), InternalCommentGuardError);
    assert.throws(() => validateTarget({ kind: "external", id: "msg-001" }), InternalCommentGuardError);
    assert.throws(() => validateTarget({ kind: "message", id: "../bad" }), InternalCommentGuardError);
    assert.throws(
      () => validateTarget({ kind: "message", id: "x".repeat(LIMITS.MAX_TARGET_ID_LENGTH + 1) }),
      InternalCommentGuardError,
    );
  });
});

describe("validateAuthor", () => {
  it("accepts team members", () => {
    assert.equal(
      validateAuthor("alice@example.test", fixture.teamMembers),
      "alice@example.test",
    );
  });

  it("rejects malformed or unauthorized authors", () => {
    assert.throws(() => validateAuthor("alice@example.test\r\nBcc: bad@example.test"), InternalCommentGuardError);
    assert.throws(() => validateAuthor("@example.test"), InternalCommentGuardError);
    assert.throws(() => validateAuthor("outsider@example.test", fixture.teamMembers), InternalCommentGuardError);
  });
});

describe("comment body guards", () => {
  it("strips control characters while preserving newlines", () => {
    assert.equal(sanitizeCommentBody("line1\nline2\0"), "line1\nline2");
  });

  it("rejects empty comments and caps long comments", () => {
    assert.throws(() => validateCommentBody(""), InternalCommentGuardError);
    assert.equal(
      sanitizeCommentBody("x".repeat(LIMITS.MAX_COMMENT_LENGTH + 1)).length,
      LIMITS.MAX_COMMENT_LENGTH,
    );
  });
});

describe("collection guards", () => {
  it("guards team roster size and shape", () => {
    assert.equal(guardTeamRoster(fixture.teamMembers), true);
    assert.throws(() => guardTeamRoster(null), InternalCommentGuardError);
    assert.throws(
      () => guardTeamRoster(new Array(LIMITS.MAX_TEAM_MEMBERS + 1).fill("a@example.test")),
      InternalCommentGuardError,
    );
  });

  it("guards comment history size", () => {
    assert.equal(guardCommentHistory(new Array(LIMITS.MAX_COMMENT_HISTORY).fill({})), true);
    assert.throws(
      () => guardCommentHistory(new Array(LIMITS.MAX_COMMENT_HISTORY + 1).fill({})),
      InternalCommentGuardError,
    );
  });
});

describe("validateCommentInput", () => {
  for (const comment of fixture.validComments) {
    it(`${comment.id} validates`, () => {
      const result = validateCommentInput(comment, fixture.teamMembers);

      assert.equal(result.author, comment.author);
      assert.equal(result.body, comment.body);
      assert.equal(result.visibility, "team-only");
    });
  }

  it("rejects hostile fixture inputs", () => {
    const [badTarget, badKind, badAuthor, outsider, emptyBody] = fixture.hostileInputs;

    assert.throws(() => validateTarget(badTarget.value), InternalCommentGuardError);
    assert.throws(() => validateTarget(badKind.value), InternalCommentGuardError);
    assert.throws(() => validateAuthor(badAuthor.value), InternalCommentGuardError);
    assert.throws(() => validateAuthor(outsider.value, fixture.teamMembers), InternalCommentGuardError);
    assert.throws(
      () =>
        validateCommentInput(
          {
            target: { kind: "message", id: "msg-001" },
            author: "alice@example.test",
            body: emptyBody.value,
          },
          fixture.teamMembers,
        ),
      InternalCommentGuardError,
    );
  });
});

describe("external payload leakage guard", () => {
  it("allows reply payloads that omit internal comments", () => {
    const payload = buildExternalReplyPayload(
      fixture.leakScenario.message,
      fixture.leakScenario.replyBody,
    );

    assert.equal(payload.to, "customer@example.test");
    assert.equal(
      assertExternalPayloadDoesNotLeakComment(payload, fixture.leakScenario.comments),
      true,
    );
  });

  it("rejects payloads that include internal comment body text", () => {
    assert.throws(
      () =>
        assertExternalPayloadDoesNotLeakComment(
          fixture.leakScenario.unsafePayload,
          fixture.leakScenario.comments,
        ),
      InternalCommentGuardError,
    );
  });
});
