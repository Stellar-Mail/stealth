import type { Draft } from "../types/draft";
import type { InboxPreviewItem } from "../types/inboxPreview";

/** Fake draft fixture for inbox preview adapter tests. */
export const previewDraftSingle: Draft = {
  id: "draft-preview-001",
  subject: "Welcome to Stealth",
  body: "Hi there!\n\nWelcome to Stealth — the secure messaging platform powered by Stellar.",
  recipients: ["newuser@stealth.demo"],
};

/** Draft with multiple recipients, used to verify primaryRecipient selection. */
export const previewDraftMultiRecipient: Draft = {
  id: "draft-preview-002",
  subject: "Action Required: Confirm backup passphrase",
  body: "Hello,\n\nPlease confirm your 24-word recovery phrase to secure your account.",
  recipients: ["alice@stealth.demo", "bob@stealth.demo"],
};

/** Draft with an empty recipients list. */
export const previewDraftNoRecipients: Draft = {
  id: "draft-preview-003",
  subject: "Internal note",
  body: "This draft has no recipients yet.",
  recipients: [],
};

/** Draft whose body starts with blank lines. */
export const previewDraftLeadingBlankLines: Draft = {
  id: "draft-preview-004",
  subject: "Delayed start",
  body: "\n\nFirst real content line here.",
  recipients: ["team@stealth.demo"],
};

/** Draft with a body line that exceeds the 120-character preview cap. */
export const previewDraftLongBody: Draft = {
  id: "draft-preview-005",
  subject: "Long body line",
  body: "A".repeat(150),
  recipients: ["long@stealth.demo"],
};

/** Draft with an empty body. */
export const previewDraftEmptyBody: Draft = {
  id: "draft-preview-006",
  subject: "No body",
  body: "",
  recipients: ["empty@stealth.demo"],
};

/** Pre-computed expected InboxPreviewItem for `previewDraftSingle`. */
export const expectedPreviewItemSingle: InboxPreviewItem = {
  id: "draft-preview-001",
  subject: "Welcome to Stealth",
  preview: "Hi there!",
  primaryRecipient: "newuser@stealth.demo",
  recipients: ["newuser@stealth.demo"],
};
