import { describe, expect, it } from "vitest";
import { calculateDatasetDiff } from "../utils/diffHelpers";
import { originalDatasetFixture, currentDatasetDraftFixture } from "../fixtures/diffFixtures";

describe("diffHelpers", () => {
  describe("calculateDatasetDiff", () => {
    it("should correctly identify added, removed, and changed items", () => {
      const diff = calculateDatasetDiff(originalDatasetFixture, currentDatasetDraftFixture);

      // Summary checks
      expect(diff.summary.added).toBe(2); // 1 message (msg-003) + 1 sender (newbie)
      expect(diff.summary.removed).toBe(2); // 1 message (msg-002) + 1 sender (colleague)
      expect(diff.summary.changed).toBe(1); // 1 message (msg-001)

      // Message checks
      const msg001 = diff.messages.find((m) => m.id === "msg-001");
      expect(msg001?.type).toBe("changed");
      expect(msg001?.fields.some((f) => f.fieldName === "subject")).toBe(true);
      expect(msg001?.fields.find((f) => f.fieldName === "subject")?.newValue).toBe(
        "Welcome (Updated)",
      );

      const msg002 = diff.messages.find((m) => m.id === "msg-002");
      expect(msg002?.type).toBe("removed");

      const msg003 = diff.messages.find((m) => m.id === "msg-003");
      expect(msg003?.type).toBe("added");

      // Sender checks
      const colleague = diff.senders.find((s) => s.id === "colleague@example.org");
      expect(colleague?.type).toBe("removed");

      const newbie = diff.senders.find((s) => s.id === "newbie@example.com");
      expect(newbie?.type).toBe("added");
    });

    it("should return empty diff for identical datasets", () => {
      const diff = calculateDatasetDiff(originalDatasetFixture, originalDatasetFixture);
      expect(diff.summary.added).toBe(0);
      expect(diff.summary.removed).toBe(0);
      expect(diff.summary.changed).toBe(0);
      expect(diff.messages).toHaveLength(0);
      expect(diff.senders).toHaveLength(0);
    });
  });
});
