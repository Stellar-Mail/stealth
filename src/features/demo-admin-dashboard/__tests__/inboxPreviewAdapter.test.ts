import { describe, expect, it } from "vitest";
import { toInboxPreviewData, toInboxPreviewItem } from "../inboxPreviewAdapter";
import {
  expectedPreviewItemSingle,
  previewDraftEmptyBody,
  previewDraftLeadingBlankLines,
  previewDraftLongBody,
  previewDraftMultiRecipient,
  previewDraftNoRecipients,
  previewDraftSingle,
} from "../fixtures/inboxPreviewFixtures";

describe("toInboxPreviewItem", () => {
  it("maps all fields from the draft deterministically", () => {
    const item = toInboxPreviewItem(previewDraftSingle);
    expect(item).toEqual(expectedPreviewItemSingle);
    // Stable across calls.
    expect(toInboxPreviewItem(previewDraftSingle)).toEqual(item);
  });

  it("does not share the recipients array reference with the source draft", () => {
    const item = toInboxPreviewItem(previewDraftSingle);
    expect(item.recipients).not.toBe(previewDraftSingle.recipients);
  });

  it("selects the first recipient as primaryRecipient for multiple recipients", () => {
    const item = toInboxPreviewItem(previewDraftMultiRecipient);
    expect(item.primaryRecipient).toBe("alice@stealth.demo");
    expect(item.recipients).toEqual(["alice@stealth.demo", "bob@stealth.demo"]);
  });

  it("sets primaryRecipient to empty string when recipients list is empty", () => {
    const item = toInboxPreviewItem(previewDraftNoRecipients);
    expect(item.primaryRecipient).toBe("");
    expect(item.recipients).toHaveLength(0);
  });

  it("skips leading blank lines when extracting the preview", () => {
    const item = toInboxPreviewItem(previewDraftLeadingBlankLines);
    expect(item.preview).toBe("First real content line here.");
  });

  it("truncates body lines longer than 120 characters with an ellipsis", () => {
    const item = toInboxPreviewItem(previewDraftLongBody);
    // 120 visible chars + "…" = 121 length in code units
    expect(item.preview.length).toBe(121);
    expect(item.preview.endsWith("…")).toBe(true);
  });

  it("returns an empty preview for a draft with an empty body", () => {
    const item = toInboxPreviewItem(previewDraftEmptyBody);
    expect(item.preview).toBe("");
  });
});

describe("toInboxPreviewData", () => {
  it("returns an empty array for an empty input", () => {
    expect(toInboxPreviewData([])).toEqual([]);
  });

  it("maps every draft in the input array, preserving order", () => {
    const drafts = [previewDraftSingle, previewDraftMultiRecipient, previewDraftNoRecipients];
    const items = toInboxPreviewData(drafts);

    expect(items).toHaveLength(3);
    expect(items[0].id).toBe("draft-preview-001");
    expect(items[1].id).toBe("draft-preview-002");
    expect(items[2].id).toBe("draft-preview-003");
  });

  it("does not mutate the input array", () => {
    const drafts = [previewDraftSingle];
    toInboxPreviewData(drafts);
    expect(drafts).toHaveLength(1);
  });

  it("returns a new array on every call", () => {
    const result1 = toInboxPreviewData([previewDraftSingle]);
    const result2 = toInboxPreviewData([previewDraftSingle]);
    expect(result1).not.toBe(result2);
  });
});
