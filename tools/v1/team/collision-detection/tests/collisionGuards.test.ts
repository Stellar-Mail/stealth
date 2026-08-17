import { describe, expect, it } from "vitest";

import { prepareCollisionInput } from "../services/collisionGuards";

describe("prepareCollisionInput", () => {
  it("rejects malformed non-array payloads before inspecting candidates", () => {
    const result = prepareCollisionInput({ id: "not-a-list" });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      {
        code: "INPUT_NOT_ARRAY",
        message: "Collision detection expects an array of candidate responses.",
      },
    ]);
    expect(result.candidates).toEqual([]);
  });

  it("sanitizes hostile text fields and records truncation warnings", () => {
    const result = prepareCollisionInput(
      [
        {
          id: "  <b>reply-1</b>  ",
          threadId: " thread-1 ",
          recipient: "USER@Example.COM",
          subject: " <script>alert(1)</script> Refund \u0000request ",
          body: "First line\nSecond line<script>evil()</script>Third line",
          attachments: [
            { name: " invoice.pdf ", sizeBytes: 2_000 },
            { name: "<svg>payload</svg>.txt", sizeBytes: 8_000 },
          ],
        },
      ],
      { maxBodyChars: 18, maxAttachmentCount: 1, maxAttachmentBytes: 5_000 },
    );

    expect(result.ok).toBe(true);
    expect(result.candidates).toMatchObject([
      {
        id: "reply-1",
        threadId: "thread-1",
        recipient: "user@example.com",
        subject: "alert(1) Refund request",
        body: "First line Second",
        attachmentCount: 1,
        totalAttachmentBytes: 2_000,
      },
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        {
          code: "BODY_TRUNCATED",
          message: "Candidate reply-1 body exceeded 18 characters and was truncated.",
        },
        {
          code: "ATTACHMENTS_TRUNCATED",
          message: "Candidate reply-1 attachments exceeded 1 items and were truncated.",
        },
      ]),
    );
  });

  it("bounds large histories without touching candidates past the configured limit", () => {
    const neverInspect = {};
    Object.defineProperty(neverInspect, "id", {
      get() {
        throw new Error("candidate beyond maxItems should not be inspected");
      },
    });

    const result = prepareCollisionInput(
      [
        {
          id: "first",
          threadId: "thread-1",
          recipient: "team@example.com",
          subject: "Status update",
          body: "I can take this request.",
        },
        neverInspect,
      ],
      { maxItems: 1 },
    );

    expect(result.ok).toBe(true);
    expect(result.inspectedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.warnings).toContainEqual({
      code: "HISTORY_TRUNCATED",
      message: "Only the first 1 candidates were inspected; 1 were skipped.",
    });
  });

  it("builds stable fingerprints for equivalent duplicate-response candidates", () => {
    const result = prepareCollisionInput([
      {
        id: "a",
        threadId: "thread-1",
        recipient: "Agent@Example.com",
        subject: " Re: Refund   request ",
        body: "I will handle this now.",
      },
      {
        id: "b",
        threadId: " thread-1 ",
        recipient: "agent@example.com",
        subject: "re: refund request",
        body: "I will handle this now.",
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.candidates[0]?.fingerprint).toBe(result.candidates[1]?.fingerprint);
  });
});
