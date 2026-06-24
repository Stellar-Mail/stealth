import { describe, expect, it } from "vitest";
import { inboxSeedDataset } from "../fixtures/inboxSeedDataset";
import { getSeedDatasetPreview } from "../utils/seedDatasetPreview";

describe("getSeedDatasetPreview", () => {
  const preview = getSeedDatasetPreview(inboxSeedDataset);

  it("returns the dataset identity", () => {
    expect(preview.id).toBe("inbox-seed-v1");
    expect(preview.name).toBe("Inbox Seed Dataset");
    expect(preview.totalMessages).toBe(21);
  });

  it("has a non-zero unique sender count", () => {
    expect(preview.uniqueSenders).toBeGreaterThan(0);
  });

  it("folder breakdown sums to total messages", () => {
    const total = preview.folderBreakdown.reduce((sum, f) => sum + f.count, 0);
    expect(total).toBe(preview.totalMessages);
  });

  it("label breakdown entries are sorted by count descending", () => {
    for (let i = 1; i < preview.labelBreakdown.length; i++) {
      expect(preview.labelBreakdown[i].count).toBeLessThanOrEqual(
        preview.labelBreakdown[i - 1].count,
      );
    }
  });

  it("stats read + unread equals total", () => {
    expect(preview.stats.read + preview.stats.unread).toBe(preview.totalMessages);
  });

  it("stats are internally consistent", () => {
    expect(preview.stats.starred).toBeGreaterThanOrEqual(0);
    expect(preview.stats.withProof).toBeGreaterThanOrEqual(0);
    expect(preview.stats.withAttachments).toBeGreaterThanOrEqual(0);
    expect(preview.stats.withCalendarEvent).toBeGreaterThanOrEqual(0);
    expect(preview.stats.snoozed).toBeGreaterThanOrEqual(0);
  });
});
