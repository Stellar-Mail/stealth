import { describe, expect, it } from "vitest";

import { analyzeSpamRisk } from "../services/spamRiskChecker";
import { benignFixture, mixedFixture, suspiciousFixture } from "./fixtures";

describe("Spam Risk Checker", () => {
  it("returns a low-risk assessment for ordinary mail", () => {
    const result = analyzeSpamRisk(benignFixture);

    expect(result.level).toBe("low");
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
    expect(result.summary).toContain("ordinary");
  });

  it("flags urgent, bait-heavy content as high risk", () => {
    const result = analyzeSpamRisk(suspiciousFixture);

    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["Urgency language", "Common spam bait phrases", "External links"]),
    );
  });

  it("uses the object form for subject and body input", () => {
    const result = analyzeSpamRisk({
      subject: "Quick question",
      body: mixedFixture,
    });

    expect(result.level).toBe("medium");
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain("External links");
  });

  it("returns a neutral result for empty input", () => {
    const result = analyzeSpamRisk("");

    expect(result.level).toBe("low");
    expect(result.score).toBe(0);
    expect(result.summary).toContain("No content");
  });
});
