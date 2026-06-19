import { describe, expect, it } from "vitest";
import {
  applyBulkLabelEdit,
  normalizeDraftLabels,
  parseDraftLabelInput,
  summarizeBulkLabelEdit,
  type DraftLabelMessage,
} from "../bulkLabelEditor";

const messages: DraftLabelMessage[] = [
  {
    id: "draft-alpha",
    subject: "Alpha update",
    labels: ["review", "Investor"],
  },
  {
    id: "draft-beta",
    subject: "Beta reply",
    labels: ["follow-up"],
  },
  {
    id: "draft-gamma",
    subject: "Gamma memo",
    labels: [],
  },
];

describe("bulkLabelEditor", () => {
  it("normalizes and de-duplicates label input", () => {
    expect(normalizeDraftLabels([" Investor ", "investor", "", "Review"])).toEqual([
      "investor",
      "review",
    ]);
    expect(parseDraftLabelInput("QA, qa  Legal")).toEqual(["qa", "legal"]);
  });

  it("adds labels across selected draft messages without mutating input", () => {
    const result = applyBulkLabelEdit(messages, ["draft-alpha", "draft-gamma"], ["QA"], "add");

    expect(messages[0].labels).toEqual(["review", "Investor"]);
    expect(result.messages.find((message) => message.id === "draft-alpha")?.labels).toEqual([
      "review",
      "investor",
      "qa",
    ]);
    expect(result.messages.find((message) => message.id === "draft-gamma")?.labels).toEqual(["qa"]);
    expect(result.summary.totalApplied).toBe(2);
  });

  it("skips duplicate labels during add operations", () => {
    const result = applyBulkLabelEdit(messages, ["draft-alpha"], ["review", "legal"], "add");

    expect(result.changes[0]).toMatchObject({
      id: "draft-alpha",
      applied: ["legal"],
      skipped: ["review"],
    });
    expect(result.summary.totalSkipped).toBe(1);
  });

  it("removes selected labels and skips labels that are missing", () => {
    const result = applyBulkLabelEdit(
      messages,
      ["draft-alpha", "draft-beta"],
      ["investor", "missing"],
      "remove",
    );

    expect(result.messages.find((message) => message.id === "draft-alpha")?.labels).toEqual([
      "review",
    ]);
    expect(result.messages.find((message) => message.id === "draft-beta")?.labels).toEqual([
      "follow-up",
    ]);
    expect(result.summary.affectedCount).toBe(1);
    expect(result.summary.totalApplied).toBe(1);
    expect(result.summary.totalSkipped).toBe(3);
  });

  it("summarizes changed and no-op edits", () => {
    const changed = applyBulkLabelEdit(messages, ["draft-beta"], ["review"], "add");
    expect(summarizeBulkLabelEdit(changed)).toBe("Added 1 label across 1 message.");

    const noChange = applyBulkLabelEdit(messages, ["draft-alpha"], ["review"], "add");
    expect(summarizeBulkLabelEdit(noChange)).toBe(
      "No changes - all labels were duplicates (1 skipped).",
    );
  });
});
