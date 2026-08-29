import { describe, expect, it } from "vitest";
import {
  buildBetaFeedbackPayload,
  BetaFeedbackValidationError,
  redactFeedbackNote,
} from "../../../src/features/feedback";
import { assertNoSecretsLeaked } from "../../fixtures/identity";

describe("beta feedback (BETA-096 / BETA-098)", () => {
  it("requires informed consent before accepting a payload", () => {
    expect(() =>
      buildBetaFeedbackPayload({
        sessionId: "sess_test",
        taskId: "compose-send",
        category: "comprehension",
        rating: 3,
        informedConsent: false,
      }),
    ).toThrow(BetaFeedbackValidationError);
  });

  it("redacts secrets from free-text notes", () => {
    const secret = "S" + "A".repeat(55);
    const note = redactFeedbackNote(`Confused by postage step. wallet=${secret}`);
    expect(note).not.toContain(secret);
    expect(note).toContain("[REDACTED]");
    assertNoSecretsLeaked(note);
  });

  it("builds a redacted submission payload", () => {
    const result = buildBetaFeedbackPayload({
      sessionId: "sess_acceptance",
      taskId: "proof-inspection",
      category: "accessibility",
      rating: 4,
      informedConsent: true,
      viewport: "mobile",
      note: "Screen reader announced compose stages clearly",
    });
    expect(result.ok).toBe(true);
    expect(result.redacted.informedConsent).toBe(true);
    assertNoSecretsLeaked(JSON.stringify(result.redacted));
  });
});
