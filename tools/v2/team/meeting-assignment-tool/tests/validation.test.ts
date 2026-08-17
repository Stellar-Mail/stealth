import { describe, it, expect } from "vitest";
import {
  sanitizeMeetingTitle,
  validateAssigneeEmail,
  validateMeetingPayload,
} from "../helpers/validation";
import { enforceAssigneeLimits, chunkAssignees } from "../helpers/performance";

describe("Meeting Assignment Tool - Validation & Performance Constraints", () => {
  describe("Validation", () => {
    it("should sanitize meeting title", () => {
      expect(sanitizeMeetingTitle("Meeting <script>alert(1)</script>")).toBe(
        "Meeting &lt;script&gt;alert(1)&lt;/script&gt;",
      );
    });

    it("should throw error if meeting title is too long", () => {
      const longTitle = "A".repeat(201);
      expect(() => sanitizeMeetingTitle(longTitle)).toThrow(/maximum length/);
    });

    it("should validate email formats correctly", () => {
      expect(validateAssigneeEmail("test@example.com")).toBe(true);
      expect(validateAssigneeEmail("invalid-email")).toBe(false);
    });

    it("should accept a valid meeting payload", () => {
      const validPayload = {
        meetingId: "m-123",
        title: "Team Sync",
        description: "Weekly sync meeting",
        assignees: ["alice@example.com", "bob@example.com"],
      };
      expect(validateMeetingPayload(validPayload)).toBe(true);
    });

    it("should reject an invalid meeting payload", () => {
      const invalidPayload = {
        meetingId: 123, // Should be string
        title: "Team Sync",
        assignees: ["invalid-email"],
      };
      expect(() => validateMeetingPayload(invalidPayload)).toThrow(/Invalid payload/);
    });
  });

  describe("Performance Limits", () => {
    it("should enforce maximum assignees", () => {
      const largeAssigneeList = Array(51).fill("test@example.com");
      expect(() => enforceAssigneeLimits(largeAssigneeList)).toThrow(/Exceeded maximum/);
    });

    it("should correctly chunk a list of assignees", () => {
      const assignees = ["a", "b", "c", "d", "e"];
      const chunks = chunkAssignees(assignees, 2);
      expect(chunks).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    });
  });
});
