import { describe, expect, it } from "vitest";
import {
  SECURITY_LIMITS,
  stripControlChars,
  stripHtml,
  summarizeEmailSafely,
  validateEmailInput,
} from "../services/security";

function validInput() {
  return {
    subject: "Weekly status",
    sender: "alex@example.com",
    receivedAt: "2026-01-02T10:00:00.000Z",
    body: "The release is on track. Please review the changelog before the demo.",
  };
}

describe("validateEmailInput — malformed and hostile shapes", () => {
  it("rejects non-object input", () => {
    for (const value of [null, undefined, "x", 42, true, ["a"]]) {
      expect(validateEmailInput(value).ok).toBe(false);
    }
  });

  it("rejects missing required fields", () => {
    const result = validateEmailInput({ subject: "Only subject" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "missing-field")).toBe(true);
    }
  });

  it("rejects fields of the wrong type", () => {
    const result = validateEmailInput({
      subject: "S",
      sender: 123,
      receivedAt: "2026-01-02T10:00:00.000Z",
      body: "Body",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "wrong-type")).toBe(true);
    }
  });
});

describe("sanitization helpers", () => {
  it("strips control characters but keeps tabs and newlines", () => {
    const cleaned = stripControlChars("a\u0000b\tc\nd");
    expect(cleaned).toContain("\t");
    expect(cleaned).toContain("\n");
    expect(cleaned).not.toContain("\u0000");
  });

  it("removes HTML tags", () => {
    expect(stripHtml("<script>alert(1)</script>hello")).toBe("alert(1)hello");
  });

  it("sanitizes subject markup on a valid email", () => {
    const result = validateEmailInput({
      ...validInput(),
      subject: "<b>Important</b> update",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subject).toBe("Important update");
    }
  });
});

describe("performance guards on large input", () => {
  it("truncates an oversized-but-bounded body and warns", () => {
    const body = "x".repeat(SECURITY_LIMITS.bodyTruncateLength + 500);
    const result = validateEmailInput({ ...validInput(), body });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.body.length).toBe(SECURITY_LIMITS.bodyTruncateLength);
      expect(result.warnings.some((issue) => issue.code === "too-long")).toBe(true);
    }
  });

  it("rejects a body past the hard ceiling", () => {
    const body = "x".repeat(SECURITY_LIMITS.maxBodyLength + 1);
    const result = validateEmailInput({ ...validInput(), body });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "too-long")).toBe(true);
    }
  });

  it("caps an oversized subject", () => {
    const subject = "s".repeat(SECURITY_LIMITS.maxSubjectLength + 50);
    const result = validateEmailInput({ ...validInput(), subject });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subject.length).toBe(SECURITY_LIMITS.maxSubjectLength);
    }
  });
});

describe("summarizeEmailSafely", () => {
  it("returns an unsupported-input error for hostile input", () => {
    const result = summarizeEmailSafely(null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("unsupported-input");
    }
  });

  it("summarizes a valid email", () => {
    const result = summarizeEmailSafely(validInput());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.summary.summary.length).toBeGreaterThan(0);
      expect(result.summary.source.sender).toBe("alex@example.com");
    }
  });

  it("handles a very long body without unbounded work", () => {
    const body = `Please review this. ${"word ".repeat(5000)}`;
    const result = summarizeEmailSafely({ ...validInput(), body });
    expect(result.status).toBe("ok");
  });
});
