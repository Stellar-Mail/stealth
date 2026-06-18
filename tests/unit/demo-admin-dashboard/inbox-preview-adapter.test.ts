import { describe, expect, it } from "vitest";
import {
  toInboxPreviewData,
  toInboxPreviewItem,
  type InboxPreviewItem,
} from "../../../src/features/demo-admin-dashboard";
import {
  expectedPreviewItemSingle,
  previewDraftEmptyBody,
  previewDraftLeadingBlankLines,
  previewDraftLongBody,
  previewDraftMultiRecipient,
  previewDraftNoRecipients,
  previewDraftSingle,
} from "../../../src/features/demo-admin-dashboard/fixtures/inboxPreviewFixtures";

describe("toInboxPreviewItem", () => {
  it("maps all fields from the draft deterministically", () => {
    const item = toInboxPreviewItem(previewDraftSingle);
    expect(item).toEqual<InboxPreviewItem>(expectedPreviewItemSingle);
    expect(toInboxPreviewItem(previewDraftSingle)).toEqual(item);
  });

  it("does not share the recipients array reference with the source draft", () => {
    const item = toInboxPreviewItem(previewDraftSingle);
    expect(item.recipients).not.toBe(previewDraftSingle.recipients);
  });

  it("selects the first recipient as primaryRecipient", () => {
    const item = toInboxPreviewItem(previewDraftMultiRecipient);
    expect(item.primaryRecipient).toBe("alice@stealth.demo");
  });

  it("sets primaryRecipient to empty string when recipients list is empty", () => {
    expect(toInboxPreviewItem(previewDraftNoRecipients).primaryRecipient).toBe("");
  });

  it("skips leading blank lines when extracting the preview", () => {
    expect(toInboxPreviewItem(previewDraftLeadingBlankLines).preview).toBe(
      "First real content line here.",
    );
  });

  it("truncates body lines longer than 120 characters with an ellipsis", () => {
    const preview = toInboxPreviewItem(previewDraftLongBody).preview;
    expect(preview.length).toBe(121);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("returns an empty preview for a draft with an empty body", () => {
    expect(toInboxPreviewItem(previewDraftEmptyBody).preview).toBe("");
  });
});

describe("toInboxPreviewData", () => {
  it("returns an empty array for an empty input", () => {
    expect(toInboxPreviewData([])).toEqual([]);
  });

  it("maps every draft preserving order", () => {
    const items = toInboxPreviewData([
      previewDraftSingle,
      previewDraftMultiRecipient,
      previewDraftNoRecipients,
    ]);
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
    expect(toInboxPreviewData([previewDraftSingle])).not.toBe(
      toInboxPreviewData([previewDraftSingle]),
    );
  });
});
