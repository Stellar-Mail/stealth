import { describe, expect, it } from "vitest";

import { detectCollisions, type ActiveReply } from "../services/collisionDetection";
import { prepareCollisionInput } from "../services/collisionGuards";

// Fills coverage gaps not reached by the existing test suite.
//
// collisionGuards gaps covered here:
//   - empty-array input (ok:true, zero counts, no warnings)
//   - CANDIDATE_MALFORMED (non-object items silently skipped with warning)
//   - CANDIDATE_MISSING_ID (object with no usable id skipped with warning)
//   - ATTACHMENTS_SIZE_LIMIT (aggregate byte cap triggers warning and stops counting)
//
// detectCollisions gaps covered here:
//   - threadSubject falls back to "Thread <threadId>" when reply has no preview
//   - collision event includes the original reply objects in the replies field
//   - two independent thread groups each produce their own collision event

describe("prepareCollisionInput — additional edge cases", () => {
  it("accepts an empty array and returns a clean zero-count result", () => {
    const result = prepareCollisionInput([]);

    expect(result.ok).toBe(true);
    expect(result.candidates).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.inspectedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("emits CANDIDATE_MALFORMED for every non-object item and produces no candidates", () => {
    const result = prepareCollisionInput([null, 42, true]);

    expect(result.ok).toBe(true);
    expect(result.candidates).toEqual([]);
    expect(result.inspectedCount).toBe(3);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.every((w) => w.code === "CANDIDATE_MALFORMED")).toBe(true);
  });

  it("emits CANDIDATE_MISSING_ID for an object with no usable id and skips it", () => {
    const result = prepareCollisionInput([
      { threadId: "t-1", recipient: "agent@team.test", subject: "Check-in", body: "On it." },
    ]);

    expect(result.ok).toBe(true);
    expect(result.candidates).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "CANDIDATE_MISSING_ID" }),
    );
  });

  it("stops counting attachments once aggregate bytes exceed maxAttachmentBytes and warns", () => {
    const result = prepareCollisionInput(
      [
        {
          id: "reply-cap",
          threadId: "t-1",
          recipient: "agent@team.test",
          subject: "Invoice",
          body: "See attached.",
          attachments: [{ sizeBytes: 3_000 }, { sizeBytes: 3_000 }],
        },
      ],
      { maxAttachmentBytes: 4_000, maxAttachmentCount: 10 },
    );

    expect(result.ok).toBe(true);
    const candidate = result.candidates[0];
    expect(candidate?.attachmentCount).toBe(1);
    expect(candidate?.totalAttachmentBytes).toBe(3_000);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "ATTACHMENTS_SIZE_LIMIT" }),
    );
  });
});

describe("detectCollisions — additional scenarios", () => {
  it("falls back to 'Thread <threadId>' as the subject when no preview is provided", () => {
    const replies: ActiveReply[] = [
      { userId: "u1", userName: "Alice", threadId: "thread-42", startedAt: "2026-07-01T09:00:00Z" },
      { userId: "u2", userName: "Bob", threadId: "thread-42", startedAt: "2026-07-01T09:01:00Z" },
    ];

    const events = detectCollisions(replies);

    expect(events).toHaveLength(1);
    expect(events[0].threadSubject).toBe("Thread thread-42");
  });

  it("includes all original reply objects in the collision event replies field", () => {
    const replies: ActiveReply[] = [
      {
        userId: "u1",
        userName: "Alice",
        threadId: "thread-7",
        startedAt: "2026-07-01T09:00:00Z",
        preview: "I can handle this.",
      },
      {
        userId: "u2",
        userName: "Bob",
        threadId: "thread-7",
        startedAt: "2026-07-01T09:02:00Z",
        preview: "On it.",
      },
    ];

    const events = detectCollisions(replies);

    expect(events[0].replies).toHaveLength(2);
    expect(events[0].replies.map((r) => r.userId)).toEqual(["u1", "u2"]);
  });

  it("produces a separate collision event for each independent thread group", () => {
    const replies: ActiveReply[] = [
      { userId: "u1", userName: "Alice", threadId: "t-a", startedAt: "2026-07-01T09:00:00Z" },
      { userId: "u2", userName: "Bob", threadId: "t-a", startedAt: "2026-07-01T09:01:00Z" },
      { userId: "u3", userName: "Carol", threadId: "t-b", startedAt: "2026-07-01T09:00:00Z" },
      { userId: "u4", userName: "Dave", threadId: "t-b", startedAt: "2026-07-01T09:01:00Z" },
    ];

    const events = detectCollisions(replies);

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.severity === "warning")).toBe(true);
    expect(new Set(events.map((e) => e.threadId)).size).toBe(2);
  });
});
