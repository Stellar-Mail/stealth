import { describe, expect, it } from "vitest";
import { AUTO_LABEL_TAXONOMY, suggestAutoLabels, validateAutoLabelEmail } from "./services";
import fixtureCases from "./fixtures/email-label-cases.json";
import type { AutoLabelEmail } from "./types";

describe("Auto Label Suggestion core service", () => {
  it("exposes the documented V1 taxonomy", () => {
    expect(AUTO_LABEL_TAXONOMY).toEqual([
      "Action needed",
      "Finance",
      "Stellar",
      "Security",
      "Calendar",
      "Newsletter",
    ]);
  });

  it("matches fixture-backed expected labels without network access", () => {
    for (const fixture of fixtureCases) {
      const { expectedLabels, ...email } = fixture;
      const result = suggestAutoLabels(email);

      expect(result.status).toBe("success");
      expect(result.suggestions.map((suggestion) => suggestion.label)).toEqual(expectedLabels);
      expect(result.source).toBe("local-deterministic-rules");
    }
  });

  it("preserves existing labels separately and does not duplicate them as suggestions", () => {
    const result = suggestAutoLabels({
      id: "already-finance",
      from: "billing@example.test",
      subject: "Invoice payment receipt",
      snippet: "Your receipt is ready for review.",
      existingLabels: ["Finance"],
    });

    expect(result.status).toBe("success");
    expect(result.preservedExistingLabels).toEqual(["Finance"]);
    expect(result.suggestions.map((suggestion) => suggestion.label)).not.toContain("Finance");
  });

  it("limits results to three ranked explainable suggestions", () => {
    const result = suggestAutoLabels({
      id: "mixed-priority",
      from: "security@stellar.example",
      subject: "Verification code and USDC payout invoice meeting",
      snippet: "Please review the payment receipt before noon and confirm the agenda invite.",
      bodyPreview:
        "Use this one-time code if you are signing in. Transaction hash is attached. Unsubscribe link included.",
    });

    expect(result.status).toBe("success");
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.map((suggestion) => suggestion.label)).toEqual([
      "Security",
      "Finance",
      "Stellar",
    ]);
    expect(result.suggestions.every((suggestion) => suggestion.reason && suggestion.evidence)).toBe(
      true,
    );
  });

  it("returns deterministic validation errors for incomplete or malformed email records", () => {
    expect(validateAutoLabelEmail({})).toEqual([
      "Email id is required.",
      "Email sender is required.",
      "Email subject is required.",
      "Email snippet is required.",
    ]);

    const result = suggestAutoLabels({
      id: "bad-date",
      from: "sender@example.test",
      subject: "Hello",
      snippet: "Preview",
      receivedAt: "not-a-date",
    } as AutoLabelEmail);

    expect(result.status).toBe("error");
    expect(result.suggestions).toEqual([]);
    expect(result.validationErrors).toContain(
      "receivedAt must be an ISO-compatible date when provided.",
    );
  });
});
