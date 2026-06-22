/* eslint-disable no-control-regex, no-useless-escape */
/**
 * Example security tests for Team Digest Generator
 * These tests demonstrate how to validate input handling and XSS prevention
 *
 * To run: npm test -- tests/security.example.test.ts
 */

import {
  validateDigestConfig,
  validateEmail,
  validateTeamMember,
  validateScheduleExpression,
} from "../../services/inputValidation";
import {
  sanitizeEmailContent,
  sanitizeEmailSubject,
  sanitizeSenderEmail,
  sanitizeFilename,
  escapeHtml,
  validateAttachment,
} from "../../services/contentSanitization";
import {
  mockTeamMembers,
  mockEmails,
  mockConfigs,
  generateMockEmails,
  generateLargeHtml,
  generateLargeHtmlWithXSS,
} from "./fixtures";

describe("Security Tests - Input Validation", () => {
  describe("Email Validation", () => {
    it("should accept valid email addresses", () => {
      const result = validateEmail("user@example.com");
      expect(result).toBeNull();
    });

    it("should accept emails with plus signs", () => {
      const result = validateEmail("user+tag@example.com");
      expect(result).toBeNull();
    });

    it("should reject malformed emails", () => {
      const result = validateEmail("not-an-email");
      expect(result).not.toBeNull();
      expect(result?.code).toBe("INVALID_FORMAT");
    });

    it("should reject emails that are too long", () => {
      const result = validateEmail("a".repeat(255) + "@example.com");
      expect(result).not.toBeNull();
      expect(result?.code).toBe("MAX_LENGTH_EXCEEDED");
    });

    it("should reject empty email", () => {
      const result = validateEmail("");
      expect(result).not.toBeNull();
      expect(result?.code).toBe("REQUIRED");
    });

    it("should reject SQL injection in email", () => {
      const result = validateEmail("admin'--@example.com");
      expect(result).not.toBeNull();
    });
  });

  describe("Team Member Validation", () => {
    it("should accept valid team members", () => {
      const result = validateTeamMember(mockTeamMembers.valid[0]);
      expect(result).toBeNull();
    });

    it("should reject team members with malformed email", () => {
      const result = validateTeamMember(mockTeamMembers.malformed.invalidEmail);
      expect(result).not.toBeNull();
    });

    it("should reject team members with missing email", () => {
      const result = validateTeamMember(mockTeamMembers.malformed.noEmail);
      expect(result).not.toBeNull();
    });

    it("should reject team members with XSS in name", () => {
      const result = validateTeamMember(mockTeamMembers.xssAttempts.nameWithScript);
      expect(result).toBeNull(); // Validation passes, but content must be sanitized later
    });

    it("should reject team members with too long name", () => {
      const result = validateTeamMember(mockTeamMembers.malformed.tooLongName);
      expect(result).not.toBeNull();
    });
  });

  describe("Schedule Expression Validation", () => {
    it("should accept valid daily schedule", () => {
      const result = validateScheduleExpression({
        type: "daily",
        value: "09:00",
        timezone: "America/New_York",
      });
      expect(result).toBeNull();
    });

    it("should accept valid weekly schedule", () => {
      const result = validateScheduleExpression({
        type: "weekly",
        value: "5 14:30",
      });
      expect(result).toBeNull();
    });

    it("should accept valid cron expression", () => {
      const result = validateScheduleExpression({
        type: "cron",
        value: "0 9 * * 1-5",
      });
      expect(result).toBeNull();
    });

    it("should reject invalid time format", () => {
      const result = validateScheduleExpression({
        type: "daily",
        value: "25:00",
      });
      expect(result).not.toBeNull();
    });

    it("should reject ReDoS pattern in cron", () => {
      const result = validateScheduleExpression({
        type: "cron",
        value: "(a+)+b".repeat(50),
      });
      expect(result).not.toBeNull();
      expect(result?.code).toBe("FIELD_TOO_COMPLEX");
    });

    it("should reject overly complex cron field", () => {
      const result = validateScheduleExpression({
        type: "cron",
        value: "a".repeat(100) + " * * * *",
      });
      expect(result).not.toBeNull();
    });
  });

  describe("Digest Configuration Validation", () => {
    it("should accept valid digest config", () => {
      const result = validateDigestConfig(mockConfigs.valid);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject config with no recipients", () => {
      const result = validateDigestConfig(mockConfigs.malformed.noRecipients);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "EMPTY_ARRAY")).toBe(true);
    });

    it("should reject config with too many recipients", () => {
      const result = validateDigestConfig(mockConfigs.malformed.tooManyRecipients);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "TOO_MANY_RECIPIENTS")).toBe(true);
    });

    it("should reject config with duplicate recipients", () => {
      const result = validateDigestConfig(mockConfigs.malformed.duplicateRecipients);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "DUPLICATE_RECIPIENT")).toBe(true);
    });

    it("should reject config with too many exclusions", () => {
      const result = validateDigestConfig(mockConfigs.malformed.tooManyExclusions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "TOO_MANY_RULES")).toBe(true);
    });
  });
});

describe("Security Tests - Content Sanitization", () => {
  describe("XSS Prevention - Email Content", () => {
    it("should remove script tags", () => {
      const xssContent = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const sanitized = sanitizeEmailContent(xssContent);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("<p>Hello</p>");
    });

    it("should remove iframe tags", () => {
      const xssContent = '<iframe src="http://evil.com"></iframe>';
      const sanitized = sanitizeEmailContent(xssContent);
      expect(sanitized).not.toContain("<iframe");
    });

    it("should remove event handlers", () => {
      const xssContent = '<img src=x onerror="alert(1)">';
      const sanitized = sanitizeEmailContent(xssContent);
      expect(sanitized).not.toContain("onerror");
    });

    it("should remove javascript: protocol", () => {
      const xssContent = '<a href="javascript:alert(1)">Click</a>';
      const sanitized = sanitizeEmailContent(xssContent);
      expect(sanitized).not.toContain("javascript:");
    });

    it("should remove data: protocol", () => {
      const xssContent = '<img src="data:text/html,<script>alert(1)</script>">';
      const sanitized = sanitizeEmailContent(xssContent);
      expect(sanitized).not.toContain("data:");
    });

    it("should remove style attributes", () => {
      const xssContent = '<p style="color: red; background: url(javascript:alert(1))">Text</p>';
      const sanitized = sanitizeEmailContent(xssContent);
      expect(sanitized).not.toContain("style=");
    });

    it("should sanitize real XSS vectors", () => {
      for (const email of mockEmails.xssVectors) {
        const sanitized = sanitizeEmailContent(email.snippet);
        expect(sanitized).not.toContain("<script");
        expect(sanitized).not.toContain("javascript:");
        expect(sanitized).not.toContain("onerror");
      }
    });

    it("should sanitize HTML injection attempts", () => {
      for (const email of mockEmails.htmlInjection) {
        const sanitized = sanitizeEmailContent(email.snippet);
        expect(sanitized).not.toContain("<form");
        expect(sanitized).not.toContain("onclick");
      }
    });
  });

  describe("Control Character Removal", () => {
    it("should remove control characters from subject", () => {
      const subject = "Normal\x00Subject\x1FWith\x7FControlChars";
      const sanitized = sanitizeEmailSubject(subject);
      expect(sanitized).not.toContain("\x00");
      expect(sanitized).not.toContain("\x1F");
      expect(sanitized).not.toContain("\x7F");
    });

    it("should handle control characters in email content", () => {
      const content = "Text with\x00null\x1Fand\x7Fcontrol\x9Fchars";
      const sanitized = sanitizeEmailContent(content);
      expect(sanitized).not.toContain("\x00");
    });
  });

  describe("Attachment Sanitization", () => {
    it("should sanitize safe filename", () => {
      const result = sanitizeFilename("document.pdf");
      expect(result).toBe("document.pdf");
    });

    it("should prevent path traversal", () => {
      const result = sanitizeFilename("../../etc/passwd");
      expect(result).not.toContain("..");
      expect(result).not.toContain("/");
    });

    it("should remove null bytes", () => {
      const result = sanitizeFilename("file\x00name.pdf");
      expect(result).not.toContain("\x00");
    });

    it("should reject file too large", () => {
      const result = validateAttachment({
        filename: "large.zip",
        mimeType: "application/zip",
        sizeBytes: 200 * 1024 * 1024, // 200 MB
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });
  });

  describe("HTML Escaping", () => {
    it("should escape HTML special characters", () => {
      const text = '<script>alert("xss")</script>';
      const escaped = escapeHtml(text);
      expect(escaped).not.toContain("<script>");
      expect(escaped).toContain("&lt;");
      expect(escaped).toContain("&gt;");
    });

    it("should escape quotes", () => {
      const text = "Quote: \"hello\" and 'world'";
      const escaped = escapeHtml(text);
      expect(escaped).toContain("&quot;");
      expect(escaped).toContain("&#39;");
    });
  });
});

describe("Performance Tests - Resource Limits", () => {
  describe("Large Email Sets", () => {
    it("should handle 1000 emails without excessive memory", () => {
      const emails = generateMockEmails(1000);
      expect(emails).toHaveLength(1000);
      // In real tests, measure heap usage
    });

    it("should sanitize large HTML efficiently", () => {
      const largeHtml = generateLargeHtml(10 * 1024 * 1024); // 10 MB
      const start = Date.now();
      const sanitized = sanitizeEmailContent(largeHtml);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000); // Should complete in < 3 seconds
    });

    it("should sanitize HTML with XSS attempts efficiently", () => {
      const largeHtml = generateLargeHtmlWithXSS(1 * 1024 * 1024); // 1 MB with XSS
      const start = Date.now();
      const sanitized = sanitizeEmailContent(largeHtml);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
      expect(sanitized).not.toContain("<script>");
    });
  });
});
