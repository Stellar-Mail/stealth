import type { Draft } from "../types/draft";

/**
 * Deterministic, fake draft dataset for previewing and testing the draft
 * dataset store. Recipients only use example.com / example.org or the reserved
 * "*stealth.demo" demo handle, so nothing references real people or addresses.
 */
export const draftDatasetSample: Draft[] = [
  {
    id: "draft-dataset-001",
    subject: "Welcome to the demo inbox",
    body: "Deterministic demo draft used to preview the admin dataset store.",
    recipients: ["ada@example.com"],
  },
  {
    id: "draft-dataset-002",
    subject: "Postage receipt preview",
    body: "Second fake draft so selectors and filters have more than one row.",
    recipients: ["grace@example.org", "linus*stealth.demo"],
  },
  {
    id: "draft-dataset-003",
    subject: "Relay diagnostics summary",
    body: "Third fake draft covering the search and filter paths deterministically.",
    recipients: ["muriel*stealth.demo"],
  },
];
