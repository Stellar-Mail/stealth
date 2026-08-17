import { describe, expect, it } from "vitest";
import {
  validateMessage,
  parseRecipientsInput,
  formatRecipientsDisplay,
  formatMessagePreview,
} from "../components/MessageEditor";
import type { Draft } from "../types/draft";

const validDraft: Draft = {
  id: "draft-test-1",
  subject: "Test Subject",
  body: "Test body content.",
  recipients: ["alice@example.com"],
};

describe("validateMessage", () => {
  it("returns no errors for a valid draft", () => {
    const issues = validateMessage(validDraft);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("returns an error when subject is empty", () => {
    const issues = validateMessage({ ...validDraft, subject: "" });
    const subjectIssues = issues.filter((i) => i.fieldPath === "subject");
    expect(subjectIssues.length).toBeGreaterThan(0);
    expect(subjectIssues[0].severity).toBe("error");
  });

  it("returns an error when subject is whitespace only", () => {
    const issues = validateMessage({ ...validDraft, subject: "   " });
    const subjectIssues = issues.filter((i) => i.fieldPath === "subject");
    expect(subjectIssues.length).toBeGreaterThan(0);
  });

  it("returns an error when body is empty", () => {
    const issues = validateMessage({ ...validDraft, body: "" });
    const bodyIssues = issues.filter((i) => i.fieldPath === "body");
    expect(bodyIssues.length).toBeGreaterThan(0);
    expect(bodyIssues[0].severity).toBe("error");
  });

  it("returns an error when recipients is empty", () => {
    const issues = validateMessage({ ...validDraft, recipients: [] });
    const recipientIssues = issues.filter((i) => i.fieldPath === "recipients");
    expect(recipientIssues.length).toBeGreaterThan(0);
    expect(recipientIssues[0].severity).toBe("error");
  });

  it("returns an error for invalid recipient format", () => {
    const issues = validateMessage({
      ...validDraft,
      recipients: ["invalid"],
    });
    const formatIssues = issues.filter((i) => i.message.includes("format is invalid"));
    expect(formatIssues.length).toBeGreaterThan(0);
  });

  it("returns a warning for unsafe recipient domain", () => {
    const issues = validateMessage({
      ...validDraft,
      recipients: ["user@unknown-domain.com"],
    });
    const domainIssues = issues.filter((i) => i.severity === "warning");
    expect(domainIssues.length).toBeGreaterThan(0);
  });

  it("strips the drafts[0]. prefix from field paths", () => {
    const issues = validateMessage({ ...validDraft, subject: "" });
    for (const issue of issues) {
      expect(issue.fieldPath).not.toMatch(/^drafts\[\d+\]\./);
    }
  });
});

describe("parseRecipientsInput", () => {
  it("returns an empty array for empty input", () => {
    expect(parseRecipientsInput("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(parseRecipientsInput("   ")).toEqual([]);
  });

  it("parses a single recipient", () => {
    expect(parseRecipientsInput("alice@example.com")).toEqual(["alice@example.com"]);
  });

  it("parses multiple comma-separated recipients", () => {
    expect(parseRecipientsInput("alice@example.com, bob@example.com")).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("trims whitespace around recipients", () => {
    expect(parseRecipientsInput("  alice@example.com  ,  bob@example.com  ")).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("filters out empty entries from trailing commas", () => {
    expect(parseRecipientsInput("alice@example.com, ")).toEqual(["alice@example.com"]);
  });

  it("handles a single entry with a trailing comma", () => {
    expect(parseRecipientsInput("alice@example.com,")).toEqual(["alice@example.com"]);
  });
});

describe("formatRecipientsDisplay", () => {
  it("returns empty string for empty array", () => {
    expect(formatRecipientsDisplay([])).toBe("");
  });

  it("returns a single recipient unchanged", () => {
    expect(formatRecipientsDisplay(["alice@example.com"])).toBe("alice@example.com");
  });

  it("joins multiple recipients with comma and space", () => {
    expect(formatRecipientsDisplay(["alice@example.com", "bob@example.com"])).toBe(
      "alice@example.com, bob@example.com",
    );
  });

  it("round-trips with parseRecipientsInput", () => {
    const input = "alice@example.com, bob@example.com";
    const parsed = parseRecipientsInput(input);
    const formatted = formatRecipientsDisplay(parsed);
    expect(parseRecipientsInput(formatted)).toEqual(parsed);
  });
});

describe("formatMessagePreview", () => {
  it("includes the subject line", () => {
    const result = formatMessagePreview(validDraft);
    expect(result).toContain(`Subject: ${validDraft.subject}`);
  });

  it("includes the To line with recipients", () => {
    const result = formatMessagePreview(validDraft);
    expect(result).toContain(`To: ${validDraft.recipients.join(", ")}`);
  });

  it("includes a separator", () => {
    const result = formatMessagePreview(validDraft);
    expect(result).toContain("---");
  });

  it("includes the body text", () => {
    const result = formatMessagePreview(validDraft);
    expect(result).toContain(validDraft.body);
  });

  it("joins all sections with newlines", () => {
    const result = formatMessagePreview(validDraft);
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]).toBe(`Subject: ${validDraft.subject}`);
    expect(lines[1]).toBe(`To: ${validDraft.recipients.join(", ")}`);
    expect(lines[2]).toBe("---");
  });
});
