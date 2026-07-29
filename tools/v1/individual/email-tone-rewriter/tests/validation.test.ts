/**
 * Tests for the validation service.
 */

import { describe, it, expect } from "vitest";
import {
  validateDraft,
  validateField,
  isDraftComplete,
  summarizeErrors,
  errorCountByField,
  criticalErrors,
  hasSafetyConcerns,
  styleSuggestions,
  normalizeDraft,
  firstErrorFor,
  errorCodes,
} from "../services/validation";
import type { RewriteRequest } from "../services/emailToneRewriter";

const VALID_DRAFT: RewriteRequest = {
  subject: "Test",
  bodyText: "Hello, please review this document.",
  tone: "formal",
};

describe("validateDraft", () => {
  it("passes for a valid draft", () => {
    const result = validateDraft(VALID_DRAFT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing body text", () => {
    const result = validateDraft({ subject: "Test", tone: "formal" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "bodyText")).toBe(true);
  });

  it("rejects empty body text", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "empty")).toBe(true);
  });

  it("rejects whitespace-only body", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "   " });
    expect(result.valid).toBe(false);
  });

  it("rejects null body text", () => {
    const result = validateDraft({
      subject: "Test",
      bodyText: null as unknown as string,
      tone: "formal",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects non-string body text", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: 123 as unknown as string });
    expect(result.valid).toBe(false);
  });

  it("rejects missing tone", () => {
    const result = validateDraft({ subject: "Test", bodyText: "Hello" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "tone")).toBe(true);
  });

  it("rejects unsupported tone", () => {
    const result = validateDraft({ ...VALID_DRAFT, tone: "sarcastic" as RewriteRequest["tone"] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "unsupported-value")).toBe(true);
  });

  it("rejects oversized subject", () => {
    const result = validateDraft({ ...VALID_DRAFT, subject: "x".repeat(201) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "too-long")).toBe(true);
  });

  it("rejects oversized body", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "x".repeat(20001) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "too-long")).toBe(true);
  });

  it("rejects non-integer maxWords", () => {
    const result = validateDraft({ ...VALID_DRAFT, maxWords: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid-type")).toBe(true);
  });

  it("rejects negative maxWords", () => {
    const result = validateDraft({ ...VALID_DRAFT, maxWords: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "out-of-range")).toBe(true);
  });

  it("rejects oversized maxWords", () => {
    const result = validateDraft({ ...VALID_DRAFT, maxWords: 2001 });
    expect(result.valid).toBe(false);
  });

  it("detects unsafe script content", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "<script>alert('xss')</script>" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "unsafe-content")).toBe(true);
  });

  it("detects javascript: URIs", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "Click javascript:void(0)" });
    expect(result.valid).toBe(false);
  });

  it("detects event handlers", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "onclick=alert(1)" });
    expect(result.valid).toBe(false);
  });

  it("warns on excessive punctuation", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "Hello!!!!! What???" });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns on excessive uppercase", () => {
    const result = validateDraft({
      ...VALID_DRAFT,
      bodyText: "PLEASE REVIEW THIS DOCUMENT IMMEDIATELY",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns on repeated words", () => {
    const result = validateDraft({ ...VALID_DRAFT, bodyText: "the the document is ready" });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns field-level errors", () => {
    const result = validateDraft({});
    expect(result.fieldErrors).toBeDefined();
    expect(Object.keys(result.fieldErrors).length).toBeGreaterThan(0);
  });

  it("accepts custom maxSubjectLength", () => {
    const result = validateDraft(
      { ...VALID_DRAFT, subject: "x".repeat(10) },
      { maxSubjectLength: 5 },
    );
    expect(result.valid).toBe(false);
  });

  it("accepts custom maxBodyLength", () => {
    const result = validateDraft(
      { ...VALID_DRAFT, bodyText: "x".repeat(100) },
      { maxBodyLength: 50 },
    );
    expect(result.valid).toBe(false);
  });

  it("allows empty subject when configured", () => {
    const result = validateDraft(
      { bodyText: "Hello", tone: "formal", subject: "" },
      { allowEmptySubject: true },
    );
    expect(result.valid).toBe(true);
  });

  it("rejects empty subject when configured", () => {
    const result = validateDraft(
      { bodyText: "Hello", tone: "formal", subject: "" },
      { allowEmptySubject: false },
    );
    expect(result.valid).toBe(false);
  });
});

describe("validateField", () => {
  it("validates subject field", () => {
    expect(validateField("subject", "Hello")).toBeNull();
    expect(validateField("subject", 123 as unknown as string)).not.toBeNull();
  });

  it("validates bodyText field", () => {
    expect(validateField("bodyText", "Hello")).toBeNull();
    expect(validateField("bodyText", "")).not.toBeNull();
  });

  it("validates tone field", () => {
    expect(validateField("tone", "formal")).toBeNull();
    expect(validateField("tone", "invalid")).not.toBeNull();
  });

  it("validates maxWords field", () => {
    expect(validateField("maxWords", 50)).toBeNull();
    expect(validateField("maxWords", -1)).not.toBeNull();
    expect(validateField("maxWords", undefined)).toBeNull();
  });

  it("returns error for unknown field", () => {
    const result = validateField("unknown" as keyof RewriteRequest, "value");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("unknown-field");
  });
});

describe("isDraftComplete", () => {
  it("returns true for complete draft", () => {
    expect(isDraftComplete(VALID_DRAFT)).toBe(true);
  });

  it("returns false for missing body", () => {
    expect(isDraftComplete({ subject: "Test", tone: "formal" })).toBe(false);
  });

  it("returns false for empty body", () => {
    expect(isDraftComplete({ ...VALID_DRAFT, bodyText: "" })).toBe(false);
  });

  it("returns false for missing tone", () => {
    expect(isDraftComplete({ subject: "Test", bodyText: "Hello" })).toBe(false);
  });

  it("returns false for unsupported tone", () => {
    expect(isDraftComplete({ ...VALID_DRAFT, tone: "invalid" as RewriteRequest["tone"] })).toBe(
      false,
    );
  });
});

describe("summarizeErrors", () => {
  it("returns no errors for valid result", () => {
    const result = validateDraft(VALID_DRAFT);
    expect(summarizeErrors(result)).toBe("No errors.");
  });

  it("lists errors for invalid result", () => {
    const result = validateDraft({});
    const summary = summarizeErrors(result);
    expect(summary).toContain("[bodyText]");
    expect(summary).toContain("[tone]");
  });
});

describe("errorCountByField", () => {
  it("counts errors per field", () => {
    const result = validateDraft({});
    const counts = errorCountByField(result);
    expect(counts["bodyText"]).toBeGreaterThan(0);
    expect(counts["tone"]).toBeGreaterThan(0);
  });
});

describe("criticalErrors", () => {
  it("filters critical errors", () => {
    const result = validateDraft({});
    const critical = criticalErrors(result);
    expect(critical.length).toBeGreaterThan(0);
    for (const err of critical) {
      expect(["required", "unsafe-content", "unsupported-value"]).toContain(err.code);
    }
  });
});

describe("hasSafetyConcerns", () => {
  it("detects script tags", () => {
    expect(hasSafetyConcerns("<script>alert(1)</script>")).toBe(true);
  });

  it("detects javascript: URIs", () => {
    expect(hasSafetyConcerns("javascript:void(0)")).toBe(true);
  });

  it("returns false for safe text", () => {
    expect(hasSafetyConcerns("Hello, this is safe.")).toBe(false);
  });
});

describe("styleSuggestions", () => {
  it("suggests for excessive punctuation", () => {
    const suggestions = styleSuggestions("Hello!!!!! What???");
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("suggests for excessive uppercase", () => {
    const suggestions = styleSuggestions("PLEASE REVIEW THIS DOCUMENT");
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("suggests for repeated words", () => {
    const suggestions = styleSuggestions("the the document");
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("suggests for very short drafts", () => {
    const suggestions = styleSuggestions("Hi.");
    expect(suggestions.some((s) => s.includes("more context"))).toBe(true);
  });

  it("returns empty for well-formed text", () => {
    const suggestions = styleSuggestions("Hello, please review this document by Friday.");
    expect(suggestions).toEqual([]);
  });
});

describe("normalizeDraft", () => {
  it("trims subject and body", () => {
    const normalized = normalizeDraft({
      subject: "  Hello  ",
      bodyText: "  World  ",
      tone: "formal",
    });
    expect(normalized.subject).toBe("Hello");
    expect(normalized.bodyText).toBe("World");
  });

  it("preserves tone and maxWords", () => {
    const normalized = normalizeDraft({ ...VALID_DRAFT, maxWords: 50 });
    expect(normalized.tone).toBe("formal");
    expect(normalized.maxWords).toBe(50);
  });

  it("handles partial drafts", () => {
    const normalized = normalizeDraft({ bodyText: "Hello" });
    expect(normalized.bodyText).toBe("Hello");
    expect(normalized.subject).toBeUndefined();
  });
});

describe("firstErrorFor", () => {
  it("returns first error for a field", () => {
    const result = validateDraft({});
    const msg = firstErrorFor(result, "bodyText");
    expect(msg).toBeTruthy();
  });

  it("returns null for valid field", () => {
    const result = validateDraft(VALID_DRAFT);
    expect(firstErrorFor(result, "bodyText")).toBeNull();
  });
});

describe("errorCodes", () => {
  it("returns unique error codes", () => {
    const result = validateDraft({});
    const codes = errorCodes(result);
    expect(codes.length).toBeGreaterThan(0);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
