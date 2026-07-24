import { describe, expect, it } from "vitest";

import {
  analyzeSentiment,
  DEFAULT_MAX_SIGNALS,
  MAX_SIGNALS_LIMIT,
  resolveMaxSignals,
} from "../services/sentimentDetector";
import { successFixtures } from "../services/fixtures";
import type { SentimentAnalysisInput } from "../types/sentimentDetector";

function makeInput(overrides: Partial<SentimentAnalysisInput> = {}): SentimentAnalysisInput {
  return {
    messageId: "msg-test-001",
    subject: "",
    body: "",
    ...overrides,
  };
}

describe("analyzeSentiment", () => {
  it("classifies each success fixture as expected", () => {
    for (const fixture of successFixtures) {
      const result = analyzeSentiment(fixture.input);
      expect(result.sentiment, fixture.name).toBe(fixture.expectedSentiment);
      expect(result.messageId).toBe(fixture.input.messageId);
    }
  });

  it("returns a neutral zero-score result when nothing matches", () => {
    const result = analyzeSentiment(
      makeInput({ subject: "Schedule", body: "The meeting is on Tuesday." }),
    );
    expect(result.sentiment).toBe("neutral");
    expect(result.score).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.signals).toEqual([]);
    expect(result.stats.positiveMatches).toBe(0);
    expect(result.stats.negativeMatches).toBe(0);
  });

  it("keeps the score inside [-1, 1]", () => {
    const positive = analyzeSentiment(
      makeInput({ body: "great great great wonderful excellent perfect" }),
    );
    const negative = analyzeSentiment(
      makeInput({ body: "terrible awful horrible worst unacceptable" }),
    );
    expect(positive.score).toBe(1);
    expect(negative.score).toBe(-1);
  });

  it("flips polarity when a negation precedes a term", () => {
    const result = analyzeSentiment(makeInput({ body: "The update is not good." }));
    expect(result.sentiment).toBe("negative");
    expect(result.stats.negationFlips).toBe(1);
    expect(result.signals[0]).toMatchObject({ term: "good", polarity: "negative", negated: true });
  });

  it("handles contraction negations within the lookback window", () => {
    const result = analyzeSentiment(makeInput({ body: "This isn't very helpful." }));
    expect(result.sentiment).toBe("negative");
    expect(result.stats.negationFlips).toBe(1);
  });

  it("weights subject matches more than body matches", () => {
    const fromSubject = analyzeSentiment(makeInput({ subject: "great" }));
    const fromBody = analyzeSentiment(makeInput({ body: "great" }));
    expect(fromSubject.signals[0].weight).toBeGreaterThan(fromBody.signals[0].weight);
  });

  it("boosts terms preceded by an intensifier", () => {
    const plain = analyzeSentiment(makeInput({ body: "happy" }));
    const boosted = analyzeSentiment(makeInput({ body: "very happy" }));
    expect(boosted.signals[0].weight).toBeGreaterThan(plain.signals[0].weight);
    expect(boosted.stats.intensifierBoosts).toBe(1);
  });

  it("raises confidence with more matched evidence", () => {
    const low = analyzeSentiment(makeInput({ body: "good" }));
    const medium = analyzeSentiment(makeInput({ body: "good great" }));
    const high = analyzeSentiment(makeInput({ body: "good great happy glad pleased" }));
    expect(low.confidence).toBe("low");
    expect(medium.confidence).toBe("medium");
    expect(high.confidence).toBe("high");
  });

  it("truncates signals to maxSignals, strongest first", () => {
    const result = analyzeSentiment(makeInput({ body: "good great happy glad pleased helpful" }), {
      maxSignals: 3,
    });
    expect(result.signals).toHaveLength(3);
    const weights = result.signals.map((signal) => signal.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
    expect(result.stats.positiveMatches).toBe(6);
  });

  it("omits signals when includeSignals is false without changing the score", () => {
    const withSignals = analyzeSentiment(makeInput({ body: "great news, thanks" }));
    const withoutSignals = analyzeSentiment(makeInput({ body: "great news, thanks" }), {
      includeSignals: false,
    });
    expect(withoutSignals.signals).toEqual([]);
    expect(withoutSignals.score).toBe(withSignals.score);
    expect(withoutSignals.sentiment).toBe(withSignals.sentiment);
  });

  it("is deterministic for identical input", () => {
    const input = makeInput({
      subject: "Problem",
      body: "The export failed but support was great.",
    });
    expect(analyzeSentiment(input)).toEqual(analyzeSentiment(input));
  });

  it("does not mutate the caller's input", () => {
    const input = makeInput({ subject: "Great", body: "Thanks a lot" });
    const snapshot = JSON.parse(JSON.stringify(input));
    analyzeSentiment(input);
    expect(input).toEqual(snapshot);
  });
});

describe("resolveMaxSignals", () => {
  it("defaults when undefined and clamps out-of-range values", () => {
    expect(resolveMaxSignals(undefined)).toBe(DEFAULT_MAX_SIGNALS);
    expect(resolveMaxSignals(0)).toBe(1);
    expect(resolveMaxSignals(10.9)).toBe(10);
    expect(resolveMaxSignals(1000)).toBe(MAX_SIGNALS_LIMIT);
  });
});
