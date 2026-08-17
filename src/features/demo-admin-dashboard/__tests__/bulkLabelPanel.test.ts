import { describe, expect, it } from "vitest";
import { calculateLabelState } from "../components/BulkLabelPanel";
import {
  applyBulkLabelEdit,
  normalizeLabelsForBulk,
  summarizeBulkLabelEdit,
} from "../bulkLabelPanel";
import type { DemoMessage } from "../types/dataset";

function makeMessage(id: string, labels: string[]): DemoMessage {
  return {
    id,
    threadId: `thread-${id}`,
    subject: `Subject ${id}`,
    snippet: `Snippet ${id}`,
    body: `Body ${id}`,
    sender: {
      address: `sender-${id}@example.com`,
      name: `Sender ${id}`,
      isTrusted: true,
    },
    recipients: [`recipient-${id}@example.org`],
    date: "2026-06-20T12:00:00Z",
    isRead: true,
    isStarred: false,
    labels,
    attachments: [],
  };
}

function sampleMessages(): DemoMessage[] {
  return [
    makeMessage("m1", ["priority", "review"]),
    makeMessage("m2", ["priority", "archive"]),
    makeMessage("m3", ["review", "archive"]),
  ];
}

describe("normalizeLabelsForBulk", () => {
  it("deduplicates case-insensitively", () => {
    expect(normalizeLabelsForBulk(["Priority", "priority", "Archive"])).toEqual([
      "priority",
      "archive",
    ]);
  });

  it("drops blank and empty labels", () => {
    expect(normalizeLabelsForBulk(["", "  ", "VIP"])).toEqual(["VIP"]);
  });
});

describe("applyBulkLabelEdit - add", () => {
  it("adds new labels to selected messages without mutating input", () => {
    const messages = sampleMessages();
    const result = applyBulkLabelEdit(messages, ["m1", "m3"], ["VIP"], "add");

    expect(messages[0].labels).toEqual(["priority", "review"]);
    expect(result.messages[0].labels).toEqual(["priority", "review", "VIP"]);
    expect(result.messages[1].labels).toEqual(["priority", "archive"]);
    expect(result.messages[2].labels).toEqual(["review", "archive", "VIP"]);
  });

  it("prevents duplicate labels", () => {
    const result = applyBulkLabelEdit(sampleMessages(), ["m1", "m2"], ["priority", "VIP"], "add");

    expect(result.messages[0].labels).toEqual(["priority", "review", "VIP"]);
    expect(result.messages[1].labels).toEqual(["priority", "archive", "VIP"]);
    expect(result.changes[0].applied).toEqual(["VIP"]);
    expect(result.changes[0].skipped).toEqual(["priority"]);
    expect(result.summary.totalApplied).toBe(2);
    expect(result.summary.totalSkipped).toBe(2);
  });
});

describe("applyBulkLabelEdit - remove", () => {
  it("removes existing labels and skips ones not present", () => {
    const result = applyBulkLabelEdit(sampleMessages(), ["m1", "m2"], ["archive"], "remove");

    expect(result.messages[0].labels).toEqual(["priority", "review"]);
    expect(result.messages[1].labels).toEqual(["priority"]);
    expect(result.summary.totalApplied).toBe(1);
    expect(result.summary.affectedCount).toBe(1);
  });

  it("skips labels not present on any selected message", () => {
    const result = applyBulkLabelEdit(
      sampleMessages(),
      ["m1"],
      ["archive", "nonexistent"],
      "remove",
    );

    expect(result.messages[0].labels).toEqual(["priority", "review"]);
    expect(result.changes[0].applied).toEqual(["archive"]);
    expect(result.changes[0].skipped).toEqual(["nonexistent"]);
    expect(result.summary.totalApplied).toBe(1);
    expect(result.summary.totalSkipped).toBe(1);
  });
});

describe("summarizeBulkLabelEdit", () => {
  it("summarizes an add across multiple messages", () => {
    const result = applyBulkLabelEdit(sampleMessages(), ["m1", "m2"], ["VIP"], "add");
    expect(summarizeBulkLabelEdit(result)).toBe("Added 2 labels across 2 messages.");
  });

  it("reports when nothing changed on add", () => {
    const result = applyBulkLabelEdit(sampleMessages(), ["m1"], ["priority"], "add");
    expect(summarizeBulkLabelEdit(result)).toBe("No changes - all were duplicates (1 skipped).");
  });

  it("reports when nothing changed on remove", () => {
    const result = applyBulkLabelEdit(sampleMessages(), ["m1"], ["nonexistent"], "remove");
    expect(summarizeBulkLabelEdit(result)).toBe("No changes - none were present (1 skipped).");
  });
});

describe("calculateLabelState", () => {
  it("deduplicates labels case-insensitively and keeps the preview stable", () => {
    const messages = [
      makeMessage("m1", ["Priority", "review"]),
      makeMessage("m2", ["priority", "review", "archive"]),
    ];

    const result = calculateLabelState(messages, [
      "Priority",
      "priority",
      "Archive",
      "Review",
      "Archive",
    ]);

    expect(result.common).toEqual(["priority", "review"]);
    expect(result.partial).toEqual(["archive"]);
    expect(result.available).toEqual([]);
  });

  it("returns empty state when no messages selected", () => {
    const result = calculateLabelState([], ["priority", "review"]);
    expect(result.common).toEqual([]);
    expect(result.partial).toEqual([]);
    expect(result.available).toEqual(["priority", "review"]);
  });

  it("categorizes labels correctly with multiple messages", () => {
    const messages = [
      makeMessage("m1", ["priority", "review", "archive"]),
      makeMessage("m2", ["priority", "review"]),
      makeMessage("m3", ["priority"]),
    ];
    const result = calculateLabelState(messages, ["priority", "review", "archive"]);

    expect(result.common).toEqual(["priority"]);
    expect(result.partial).toEqual(["archive", "review"]);
    expect(result.available).toEqual([]);
  });
});
