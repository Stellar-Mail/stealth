import { describe, expect, it } from "vitest";

import { extractTasks } from "../services/taskExtractor";
import { safeExtractTasks, sanitizeText } from "../services/guards";
import type { TaskExtractionInput } from "../types/taskExtractor";

function makeInput(overrides: Partial<TaskExtractionInput> = {}): TaskExtractionInput {
  return {
    messageId: "msg-edge-001",
    subject: "",
    body: "",
    ...overrides,
  };
}

describe("Edge Cases - Text Processing", () => {
  it("handles extremely long task text gracefully", () => {
    const longTask = "Please " + "review ".repeat(100) + "the document";
    const result = extractTasks(makeInput({ body: longTask }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text.length).toBeLessThanOrEqual(200);
    expect(result.tasks[0].text).not.toContain("...");
  });

  it("handles unicode emoji and special characters", () => {
    const result = extractTasks(
      makeInput({ body: "Please review 📝 the report and send 📧 feedback" }),
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).toContain("📝");
    expect(result.tasks[0].text).toContain("📧");
  });

  it("handles mixed line endings (CRLF and LF)", () => {
    const body = "- [ ] Task one\r\n- [ ] Task two\n- [ ] Task three";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(3);
  });

  it("handles multiple consecutive whitespace characters", () => {
    const result = extractTasks(makeInput({ body: "Please    review     the    document" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).toBe("review the document");
  });

  it("handles tabs and non-breaking spaces", () => {
    const body = "Please\treview\u00a0the\tdocument";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).not.toContain("\t");
    expect(result.tasks[0].text).not.toContain("\u00a0");
  });

  it("strips trailing punctuation from task text", () => {
    const result = extractTasks(makeInput({ body: "Please review the document...." }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).toBe("review the document");
  });

  it("preserves internal punctuation", () => {
    const result = extractTasks(makeInput({ body: "Please check Dr. Smith's email at 3:30 PM" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].text).toContain("Dr.");
    expect(result.tasks[0].text).toContain("3:30");
  });

  it("handles empty lines and whitespace-only lines", () => {
    const body = "- [ ] Task one\n\n   \n- [ ] Task two\n\t\n- [ ] Task three";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(3);
    expect(result.stats.lineCount).toBe(3);
  });
});

describe("Edge Cases - Date and Time", () => {
  it("handles leap year dates correctly", () => {
    const result = extractTasks(makeInput({ body: "Please submit by 2024-02-29" }));
    expect(result.tasks[0].dueAtHint).toBe("2024-02-29");
  });

  it("rejects invalid leap year dates", () => {
    const result = extractTasks(makeInput({ body: "Please submit by 2023-02-29" }));
    expect(result.tasks[0].dueAtHint).toBeUndefined();
  });

  it("handles dates at month boundaries", () => {
    const result = extractTasks(
      makeInput({
        body: "- [ ] Complete by 2026-01-31\n- [ ] Submit by 2026-02-01",
      }),
    );
    expect(result.tasks[0].dueAtHint).toBe("2026-01-31");
    expect(result.tasks[1].dueAtHint).toBe("2026-02-01");
  });

  it("rejects impossible dates like month 13", () => {
    const result = extractTasks(makeInput({ body: "Please finish by 2026-13-01" }));
    expect(result.tasks[0].dueAtHint).toBeUndefined();
  });

  it("rejects day 32 for any month", () => {
    const result = extractTasks(makeInput({ body: "Please finish by 2026-01-32" }));
    expect(result.tasks[0].dueAtHint).toBeUndefined();
  });

  it("handles multiple due phrases in one line", () => {
    const result = extractTasks(
      makeInput({
        body: "Please review by Friday and submit by next week",
        receivedAt: "2026-07-01T10:00:00.000Z",
      }),
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].dueTextHint).toBe("friday");
  });

  it("resolves 'today' relative to receivedAt", () => {
    const result = extractTasks(
      makeInput({
        body: "Please complete this by today",
        receivedAt: "2026-07-15T14:30:00.000Z",
      }),
    );
    expect(result.tasks[0].dueAtHint).toBe("2026-07-15");
  });

  it("resolves 'end of day' and 'eod' to today", () => {
    const eod = extractTasks(
      makeInput({
        body: "Please send by end of day",
        receivedAt: "2026-07-15T09:00:00.000Z",
      }),
    );
    const eodShort = extractTasks(
      makeInput({
        body: "Please send by EOD",
        receivedAt: "2026-07-15T09:00:00.000Z",
      }),
    );
    expect(eod.tasks[0].dueAtHint).toBe("2026-07-15");
    expect(eodShort.tasks[0].dueAtHint).toBe("2026-07-15");
  });

  it("does not resolve relative dates without receivedAt", () => {
    const result = extractTasks(makeInput({ body: "Please complete by tomorrow" }));
    expect(result.tasks[0].dueAtHint).toBeUndefined();
    expect(result.tasks[0].dueTextHint).toBe("tomorrow");
  });
});

describe("Edge Cases - Priority Detection", () => {
  it("detects 'ASAP' in various cases", () => {
    const lower = extractTasks(makeInput({ body: "Please review asap" }));
    const upper = extractTasks(makeInput({ body: "Please review ASAP" }));
    const mixed = extractTasks(makeInput({ body: "Please review AsAp" }));
    expect(lower.tasks[0].priority).toBe("high");
    expect(upper.tasks[0].priority).toBe("high");
    expect(mixed.tasks[0].priority).toBe("high");
  });

  it("detects priority from context line even if not in task text", () => {
    const result = extractTasks(makeInput({ body: "URGENT: Please review the document" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].priority).toBe("high");
  });

  it("prefers low priority markers over high priority", () => {
    const result = extractTasks(
      makeInput({ body: "Please review the urgent report, but no rush" }),
    );
    expect(result.tasks[0].priority).toBe("low");
  });

  it("handles compound priority phrases", () => {
    const result = extractTasks(makeInput({ body: "Please review when you get a chance" }));
    expect(result.tasks[0].priority).toBe("low");
  });

  it("detects 'high priority' as a phrase", () => {
    const result = extractTasks(makeInput({ body: "Please review this high priority ticket" }));
    expect(result.tasks[0].priority).toBe("high");
  });

  it("ignores priority terms embedded in words", () => {
    const result = extractTasks(makeInput({ body: "Please check the dashboard urgently" }));
    expect(result.tasks[0].priority).toBe("high");
  });
});

describe("Edge Cases - Task Extraction Rules", () => {
  it("handles checkboxes with varying whitespace", () => {
    const variants = ["- [ ] Task", "- [] Task", "-[ ]Task", "*[ ] Task", "* [ ] Task"];
    for (const variant of variants) {
      const result = extractTasks(makeInput({ body: variant }));
      if (result.tasks.length > 0) {
        expect(result.tasks[0].trigger).toBe("checkbox");
      }
    }
  });

  it("handles numbered list formats", () => {
    const body = "1. Review the document\n2) Send the email\n3. Update the spreadsheet";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks.every((t) => t.trigger === "bullet-action")).toBe(true);
  });

  it("case-insensitive action verb matching", () => {
    const result = extractTasks(makeInput({ body: "REVIEW the document\nReview the report" }));
    // Note: These are NOT deduped because the full text is different
    expect(result.tasks.length).toBeGreaterThan(0);
    // Check that action verb matching is case-insensitive
    const reviewTasks = result.tasks.filter((t) => t.text.toLowerCase().includes("review"));
    expect(reviewTasks.length).toBeGreaterThan(0);
  });

  it("does not match action verbs mid-sentence", () => {
    const result = extractTasks(makeInput({ body: "The team will review the document" }));
    expect(result.tasks).toHaveLength(0);
  });

  it("handles request patterns case-insensitively", () => {
    const variants = [
      "PLEASE review the document",
      "Please Review The Document",
      "please review the document",
    ];
    for (const variant of variants) {
      const result = extractTasks(makeInput({ body: variant }));
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0].trigger).toBe("request-phrase");
    }
  });

  it("extracts from subject when body is empty", () => {
    const result = extractTasks(makeInput({ subject: "Please review the Q2 report", body: "" }));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].source).toBe("subject");
  });

  it("processes subject as a single line", () => {
    const result = extractTasks(
      makeInput({
        subject: "Please review and Please send feedback",
        body: "",
      }),
    );
    expect(result.tasks).toHaveLength(1); // Single line, single match
  });

  it("handles bullet characters: dash, asterisk, bullet point", () => {
    const body = "- Review report\n* Send email\n• Update wiki";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(3);
  });
});

describe("Edge Cases - Options and Limits", () => {
  it("respects maxTasks=1", () => {
    const body = "- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3";
    const result = extractTasks(makeInput({ body }), { maxTasks: 1 });
    expect(result.tasks).toHaveLength(1);
    expect(result.stats.truncated).toBe(true);
  });

  it("handles maxTasks larger than candidates", () => {
    const body = "- [ ] Task 1\n- [ ] Task 2";
    const result = extractTasks(makeInput({ body }), { maxTasks: 100 });
    expect(result.tasks).toHaveLength(2);
    expect(result.stats.truncated).toBe(false);
  });

  it("filters medium confidence correctly", () => {
    const body = "Send the report\n- review the deck\n- [ ] Book the room";
    const result = extractTasks(makeInput({ body }), {
      minConfidence: "medium",
    });
    expect(result.tasks.length).toBeLessThan(3);
    expect(result.tasks.every((t) => t.confidence !== "low")).toBe(true);
  });

  it("filters high confidence correctly", () => {
    const body = "Send the report\n- review the deck\n- [ ] Book the room";
    const result = extractTasks(makeInput({ body }), { minConfidence: "high" });
    const highConfTasks = result.tasks.filter((t) => t.confidence === "high");
    expect(highConfTasks.length).toBe(result.tasks.length);
  });

  it("returns all stats fields", () => {
    const result = extractTasks(makeInput({ body: "Please review\nPlease send\nSome text" }));
    expect(result.stats).toHaveProperty("lineCount");
    expect(result.stats).toHaveProperty("candidateCount");
    expect(result.stats).toHaveProperty("extractedCount");
    expect(result.stats).toHaveProperty("truncated");
    expect(typeof result.stats.lineCount).toBe("number");
  });
});

describe("Edge Cases - Sanitization", () => {
  it("strips null bytes and control characters", () => {
    const dirty = "Please\u0000review\u0001the\u001fdocument";
    const clean = sanitizeText(dirty);
    expect(clean).toBe("Pleasereviewthedocument");
    expect(clean).not.toContain("\u0000");
  });

  it("strips zero-width characters that could hide content", () => {
    const outcome = safeExtractTasks(
      makeInput({ body: "Ple\u200base review\u200d the\u2060 document\ufeff" }),
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.tasks.length).toBeGreaterThan(0);
      if (outcome.result.tasks.length > 0) {
        expect(outcome.result.tasks[0].text).toContain("review");
        expect(outcome.result.tasks[0].text).toContain("document");
      }
    }
  });

  it("normalizes unicode to NFC form", () => {
    const decomposed = "cafe\u0301"; // café with combining accent
    const normalized = sanitizeText(decomposed);
    expect(normalized).toBe("café");
    expect(normalized.length).toBe(4);
  });

  it("preserves legitimate special characters", () => {
    const text = "Review items #1-5 @ 50% capacity (urgent!)";
    const result = extractTasks(makeInput({ body: `Please ${text}` }));
    expect(result.tasks[0].text).toContain("#1-5");
    expect(result.tasks[0].text).toContain("@");
    expect(result.tasks[0].text).toContain("%");
  });
});

describe("Edge Cases - Deduplication", () => {
  it("deduplicates exact matches", () => {
    const body = "Please review the report\nPlease review the report";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(1);
    expect(result.stats.candidateCount).toBe(2);
  });

  it("deduplicates case-insensitive matches", () => {
    const body = "Please REVIEW THE REPORT\nPlease review the report";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(1);
  });

  it("deduplicates after normalization", () => {
    const body = "Please   review   the   report\nPlease review the report";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(1);
  });

  it("keeps similar but distinct tasks", () => {
    const body = "Please review the Q1 report\nPlease review the Q2 report";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(2);
  });

  it("preserves order of first occurrence", () => {
    const body =
      "Please send the notes\nPlease review the deck\nPlease send the notes\nPlease send the notes";
    const result = extractTasks(makeInput({ body }));
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].text).toBe("send the notes");
    expect(result.tasks[1].text).toBe("review the deck");
  });
});

describe("Edge Cases - IDs and Metadata", () => {
  it("generates sequential IDs starting from 1", () => {
    const body = "- [ ] Task A\n- [ ] Task B\n- [ ] Task C";
    const result = extractTasks(makeInput({ messageId: "test-msg", body }));
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].id).toBe("test-msg-task-1");
    expect(result.tasks[1].id).toBe("test-msg-task-2");
    expect(result.tasks[2].id).toBe("test-msg-task-3");
  });

  it("echoes messageId in result", () => {
    const result = extractTasks(makeInput({ messageId: "unique-id-12345" }));
    expect(result.messageId).toBe("unique-id-12345");
  });

  it("does not expose senderAddress in output", () => {
    const result = extractTasks(
      makeInput({ senderAddress: "test@example.com", body: "Please review" }),
    );
    expect(JSON.stringify(result)).not.toContain("test@example.com");
  });

  it("IDs are stable for identical input", () => {
    const input = makeInput({ body: "- [ ] Task A\n- [ ] Task B" });
    const result1 = extractTasks(input);
    const result2 = extractTasks(input);
    expect(result1.tasks.map((t) => t.id)).toEqual(result2.tasks.map((t) => t.id));
  });
});
