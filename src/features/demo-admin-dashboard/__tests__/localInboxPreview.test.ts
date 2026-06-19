import { describe, expect, it } from "vitest";
import { inboxSeedDataset } from "../fixtures/inboxSeedDataset";
import {
  formatLocalInboxPreviewSubtitle,
  getLocalInboxPreviewReader,
  getLocalInboxPreviewRows,
  getLocalInboxPreviewRowsForFolder,
} from "../utils/localInboxPreview";

describe("localInboxPreview", () => {
  it("maps seed messages into newest-first preview rows", () => {
    const rows = getLocalInboxPreviewRows(inboxSeedDataset);

    expect(rows).toHaveLength(inboxSeedDataset.messages.length);
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].date <= rows[index - 1].date).toBe(true);
    }
    expect(rows[0]).toMatchObject({
      subject: "Waiting for wallet signature",
      folder: "outbox",
      hasProof: true,
    });
  });

  it("filters rows by local folder mapping", () => {
    const requests = getLocalInboxPreviewRowsForFolder(inboxSeedDataset, "requests");

    expect(requests.map((row) => row.id).sort()).toEqual([
      "seed-msg-05",
      "seed-msg-05b",
      "seed-msg-05c",
    ]);
  });

  it("builds a reader preview for a selected message", () => {
    const reader = getLocalInboxPreviewReader(inboxSeedDataset, "seed-msg-01");

    expect(reader?.row.subject).toBe("Q2 brand system - final direction");
    expect(reader?.attachmentNames).toContain("vantage-identity-v3.pdf");
    expect(reader?.proofStatus).toBe("verified");
    expect(reader?.recipients).toEqual(["eve@stealth.xyz"]);
  });

  it("falls back to the newest unread message when selection is missing", () => {
    const reader = getLocalInboxPreviewReader(inboxSeedDataset, "missing");

    expect(reader?.row.isRead).toBe(false);
    expect(reader?.row.id).toBe("seed-msg-13");
  });

  it("formats list subtitles with folder and read state", () => {
    const row = getLocalInboxPreviewRows(inboxSeedDataset).find(
      (item) => item.id === "seed-msg-01",
    );

    expect(row).toBeDefined();
    expect(formatLocalInboxPreviewSubtitle(row!)).toBe("priority / unread, starred");
  });
});
