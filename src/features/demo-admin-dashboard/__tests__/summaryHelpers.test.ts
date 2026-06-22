import { describe, expect, it } from "vitest";
import { calculateDatasetSummary } from "../utils/summaryHelpers";
import { validDatasetFixture, invalidDatasetFixture } from "../fixtures/summaryFixtures";

describe("summaryHelpers", () => {
  describe("calculateDatasetSummary", () => {
    it("should correctly summarize a valid dataset with no warnings", () => {
      const summary = calculateDatasetSummary(validDatasetFixture);

      expect(summary.messageCount).toBe(1);
      expect(summary.senderCount).toBe(1);
      expect(summary.unreadCount).toBe(0);
      expect(summary.starredCount).toBe(0);
      expect(summary.warnings).toHaveLength(0);
    });

    it("should identify warnings and errors in an invalid dataset", () => {
      const summary = calculateDatasetSummary(invalidDatasetFixture);

      expect(summary.messageCount).toBe(1);
      expect(summary.warnings.length).toBeGreaterThan(0);

      // Check for specific warnings
      const emptySubject = summary.warnings.find((w) => w.id.includes("warn-subject"));
      expect(emptySubject).toBeDefined();
      expect(emptySubject?.severity).toBe("warning");

      const unsafeSender = summary.warnings.find((w) => w.message.includes("realuser@gmail.com"));
      expect(unsafeSender).toBeDefined();
      expect(unsafeSender?.severity).toBe("error");

      const unsafeRecipient = summary.warnings.find((w) => w.message.includes("someone@yahoo.com"));
      expect(unsafeRecipient).toBeDefined();
      expect(unsafeRecipient?.severity).toBe("error");

      const missingSenderName = summary.warnings.find((w) => w.category === "sender");
      expect(missingSenderName).toBeDefined();
      expect(missingSenderName?.severity).toBe("info");
    });

    it("should estimate size correctly", () => {
      const summary = calculateDatasetSummary(validDatasetFixture);
      expect(summary.totalSizeEstimate).toBeGreaterThan(0);
    });
  });
});
