import { describe, expect, it } from "vitest";
import {
  attachPrivateNote,
  failureFixtures,
  PRIVATE_NOTE_LIMITS,
  safeAttachPrivateNote,
  sanitizeText,
  successFixtures,
  validatePrivateNoteInput,
  validatePrivateNoteOptions,
} from "../index";

describe("Private Note on Email - Non-UI Execution Contract", () => {
  describe("Sanitization & Guards", () => {
    it("strips HTML tags and normalizes whitespace", () => {
      const dirty = "<div>Hello   <b>world</b>!   \n\n   New line</div>";
      const clean = sanitizeText(dirty, true);
      expect(clean).toBe("Hello world ! New line");
    });

    it("validates input structure and required fields", () => {
      const result = validatePrivateNoteInput({ noteText: "Valid text" });
      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "requestId" }),
          expect.objectContaining({ field: "emailId" }),
        ]),
      );
    });

    it("validates options bounds", () => {
      const result = validatePrivateNoteOptions({ maxNoteLength: 999999 });
      expect(result.valid).toBe(false);
      expect(result.issues[0].field).toBe("maxNoteLength");
    });
  });

  describe("Pure Service: attachPrivateNote", () => {
    it("attaches a private note deterministically with metadata and word counts", () => {
      const output = attachPrivateNote({
        requestId: "req_test_01",
        emailId: "email_abc123",
        emailSubject: "Quarterly Review Sync",
        emailSender: "bob@example.com",
        noteText: "Action item: Prepare Q3 metrics slides.",
        importance: "high",
        visibility: "private",
        tags: ["ActionItem", "Metrics"],
      });

      expect(output.requestId).toBe("req_test_01");
      expect(output.emailId).toBe("email_abc123");
      expect(output.noteId).toMatch(/^note_email_abc123_/);
      expect(output.cleanNoteText).toBe("Action item: Prepare Q3 metrics slides.");
      expect(output.importance).toBe("high");
      expect(output.visibility).toBe("private");
      expect(output.tags).toEqual(["actionitem", "metrics", "action"]);
      expect(output.characterCount).toBe(39);
      expect(output.wordCount).toBe(6);
      expect(output.metadata.emailSubjectSnippet).toBe("Quarterly Review Sync");
      expect(output.metadata.emailSender).toBe("bob@example.com");
      expect(output.metadata.autoTagged).toBe(true);
      expect(Date.parse(output.createdAt)).not.toBeNaN();
    });
  });

  describe("Guarded Service: safeAttachPrivateNote", () => {
    it("executes safely and returns status ok for valid inputs", () => {
      const res = safeAttachPrivateNote({
        requestId: "req_safe_01",
        emailId: "email_safe_100",
        noteText: "Check contract terms before signing.",
      });

      expect(res.status).toBe("ok");
      if (res.status === "ok") {
        expect(res.result.cleanNoteText).toBe("Check contract terms before signing.");
        expect(res.result.importance).toBe("medium");
      }
    });

    it("never throws when receiving arbitrary untrusted inputs", () => {
      expect(() => safeAttachPrivateNote(null)).not.toThrow();
      expect(() => safeAttachPrivateNote(undefined)).not.toThrow();
      expect(() => safeAttachPrivateNote("string_instead_of_object")).not.toThrow();
      expect(() => safeAttachPrivateNote([], { maxNoteLength: "invalid" })).not.toThrow();
    });
  });

  describe("Fixture Driven Verification", () => {
    it("passes all successFixtures", () => {
      for (const fixture of successFixtures) {
        const res = safeAttachPrivateNote(fixture.input, fixture.options);
        expect(res.status, `Fixture ${fixture.name} should succeed`).toBe("ok");
        if (res.status === "ok") {
          expect(res.result.cleanNoteText).toBe(fixture.expected.cleanNoteText);
          expect(res.result.importance).toBe(fixture.expected.importance);
          expect(res.result.visibility).toBe(fixture.expected.visibility);
          if (fixture.expected.tagsContains) {
            for (const tag of fixture.expected.tagsContains) {
              expect(res.result.tags).toContain(tag);
            }
          }
          if (fixture.expected.hasReminder) {
            expect(res.result.reminderAt).not.toBeNull();
          } else {
            expect(res.result.reminderAt).toBeNull();
          }
        }
      }
    });

    it("fails with expected error codes for all failureFixtures", () => {
      for (const fixture of failureFixtures) {
        const res = safeAttachPrivateNote(fixture.input, fixture.options);
        expect(res.status, `Fixture ${fixture.name} should return error`).toBe("error");
        if (res.status === "error") {
          expect(res.code, `Fixture ${fixture.name} error code`).toBe(fixture.expectedErrorCode);
          expect(res.issues.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
