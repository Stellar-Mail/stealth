import { describe, expect, it } from "vitest";

import {
  improveReadability,
  countSyllables,
  resolveMaxIssues,
  DEFAULT_MAX_ISSUES,
  MAX_ISSUES_LIMIT,
  MAX_EXCERPT_CHARS,
  LONG_SENTENCE_WORDS,
  VERY_LONG_SENTENCE_WORDS,
} from "../services/readabilityImprover";
import { successFixtures } from "../services/fixtures";
import type { ReadabilityInput } from "../types/readabilityImprover";

function makeInput(overrides: Partial<ReadabilityInput> = {}): ReadabilityInput {
  return {
    messageId: "msg-test-001",
    subject: "",
    body: "",
    ...overrides,
  };
}

function sentenceOf(wordCount: number): string {
  return `${Array(wordCount).fill("word").join(" ")}.`;
}

describe("improveReadability", () => {
  it("reports the expected issue types for each success fixture", () => {
    for (const fixture of successFixtures) {
      const result = improveReadability(fixture.input);
      expect(
        result.issues.map((issue) => issue.type),
        fixture.name,
      ).toEqual(fixture.expectedIssueTypes);
      expect(result.messageId).toBe(fixture.input.messageId);
    }
  });

  it("scores simple text as easier than dense formal text", () => {
    const simple = improveReadability(
      makeInput({ body: "We met today. The plan is set. See you soon." }),
    );
    const dense = improveReadability(
      makeInput({
        body: "Organizational stakeholders continuously prioritize comprehensive administrative documentation notwithstanding considerable operational complexity.",
      }),
    );
    expect(simple.score).toBeGreaterThan(dense.score);
    expect(simple.grade).toBe("very-easy");
    expect(dense.grade).toBe("very-hard");
  });

  it("clamps the score to [0, 100]", () => {
    const short = improveReadability(makeInput({ body: "Go now. Do it. Be quick." }));
    const brutal = improveReadability(
      makeInput({
        body: "Incontrovertibly, institutionalization of interdisciplinary organizational responsibilities necessitates internationalization.",
      }),
    );
    expect(short.score).toBeLessThanOrEqual(100);
    expect(short.score).toBeGreaterThanOrEqual(0);
    expect(brutal.score).toBe(0);
  });

  it("flags long sentences as info and very long sentences as warn", () => {
    const long = improveReadability(makeInput({ body: sentenceOf(LONG_SENTENCE_WORDS + 1) }));
    const veryLong = improveReadability(
      makeInput({ body: sentenceOf(VERY_LONG_SENTENCE_WORDS + 1) }),
    );
    expect(long.issues[0]).toMatchObject({ type: "long-sentence", severity: "info" });
    expect(veryLong.issues[0]).toMatchObject({ type: "long-sentence", severity: "warn" });
    expect(veryLong.metrics.longSentenceCount).toBe(1);
  });

  it("suggests plain-language replacements for wordy terms", () => {
    const result = improveReadability(makeInput({ body: "We will utilize the tool." }));
    expect(result.issues[0]).toMatchObject({
      type: "complex-word",
      excerpt: "utilize",
      suggestion: 'Replace "utilize" with "use".',
    });
  });

  it("flags passive voice with an active-voice suggestion", () => {
    const result = improveReadability(makeInput({ body: "The budget was approved by the board." }));
    expect(result.issues[0]).toMatchObject({ type: "passive-voice", severity: "info" });
  });

  it("flags repeated all-caps words as shouting", () => {
    const shouting = improveReadability(makeInput({ body: "SEND THIS NOW PLEASE." }));
    const calm = improveReadability(makeInput({ body: "Send the NASA report." }));
    expect(shouting.issues[0]).toMatchObject({ type: "shouting", severity: "warn" });
    expect(calm.issues).toEqual([]);
  });

  it("flags paragraphs above the word limit", () => {
    const paragraph = Array(21).fill("one two three four five.").join(" ");
    const result = improveReadability(makeInput({ body: paragraph }));
    expect(result.issues.some((issue) => issue.type === "long-paragraph")).toBe(true);
  });

  it("caps excerpts at the excerpt limit", () => {
    const result = improveReadability(makeInput({ body: sentenceOf(60) }));
    for (const issue of result.issues) {
      expect(issue.excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS + 1);
    }
  });

  it("computes deterministic metrics", () => {
    const result = improveReadability(
      makeInput({
        subject: "Quick note",
        body: "First point here.\n\nSecond point is longer than the first one.",
      }),
    );
    expect(result.metrics).toMatchObject({
      sentenceCount: 3,
      paragraphCount: 2,
      wordCount: 13,
    });
    expect(result.metrics.averageWordsPerSentence).toBeCloseTo(13 / 3, 1);
  });

  it("truncates issues to maxIssues and reports it in stats", () => {
    const body = Array(5).fill("We will utilize and leverage assistance.").join(" ");
    const result = improveReadability(makeInput({ body }), { maxIssues: 4 });
    expect(result.issues).toHaveLength(4);
    expect(result.stats.truncated).toBe(true);
    expect(result.stats.issueCandidates).toBeGreaterThan(4);
  });

  it("omits issues when includeIssues is false without changing the score", () => {
    const body = "We will utilize the tool.";
    const withIssues = improveReadability(makeInput({ body }));
    const withoutIssues = improveReadability(makeInput({ body }), { includeIssues: false });
    expect(withoutIssues.issues).toEqual([]);
    expect(withoutIssues.score).toBe(withIssues.score);
    expect(withoutIssues.stats.issueCandidates).toBe(withIssues.stats.issueCandidates);
  });

  it("is deterministic for identical input", () => {
    const input = makeInput({
      subject: "URGENT UPDATE NEEDED",
      body: "The report was completed. We will utilize the findings to facilitate planning.",
    });
    expect(improveReadability(input)).toEqual(improveReadability(input));
  });

  it("does not mutate the caller's input", () => {
    const input = makeInput({ subject: "Note", body: "We will utilize the tool." });
    const snapshot = JSON.parse(JSON.stringify(input));
    improveReadability(input);
    expect(input).toEqual(snapshot);
  });
});

describe("countSyllables", () => {
  it("estimates syllables deterministically", () => {
    expect(countSyllables("go")).toBe(1);
    expect(countSyllables("table")).toBe(2);
    expect(countSyllables("delete")).toBe(2);
    expect(countSyllables("organization")).toBeGreaterThanOrEqual(4);
    expect(countSyllables("")).toBe(0);
  });
});

describe("resolveMaxIssues", () => {
  it("defaults when undefined and clamps out-of-range values", () => {
    expect(resolveMaxIssues(undefined)).toBe(DEFAULT_MAX_ISSUES);
    expect(resolveMaxIssues(0)).toBe(1);
    expect(resolveMaxIssues(12.7)).toBe(12);
    expect(resolveMaxIssues(1000)).toBe(MAX_ISSUES_LIMIT);
  });
});
