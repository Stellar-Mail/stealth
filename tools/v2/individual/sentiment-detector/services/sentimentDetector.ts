// Sentiment Detector — core detection engine.
//
// Lexicon-based scoring over subject and body text. Pure and deterministic:
// no network calls, no mailbox access, no randomness, no clock reads, and no
// mutation of caller-supplied objects. Presentation concerns stay out of this
// module — callers receive plain data and decide how to render it.

import type {
  SentimentAnalysisInput,
  SentimentAnalysisOptions,
  SentimentAnalysisResult,
  SentimentConfidence,
  SentimentLabel,
  SentimentSignal,
  SentimentStats,
  SignalSource,
} from "../types/sentimentDetector";

export const DEFAULT_MAX_SIGNALS = 25;
export const MAX_SIGNALS_LIMIT = 100;

/** Subject terms carry more intent than body terms. */
export const SUBJECT_WEIGHT_MULTIPLIER = 1.5;
/** Boost applied when an intensifier directly precedes a term. */
export const INTENSIFIER_MULTIPLIER = 1.5;
/** How many tokens back a negation may sit and still flip a term. */
export const NEGATION_WINDOW = 2;

/** Score magnitude required before leaving the neutral band. */
export const NEUTRAL_BAND = 0.2;
/** Minority/majority weight ratio at which both polarities read as mixed. */
export const MIXED_RATIO = 0.5;

export const POSITIVE_TERMS: Readonly<Record<string, number>> = {
  amazing: 2,
  appreciate: 2,
  appreciated: 2,
  awesome: 2,
  congratulations: 2,
  delighted: 2,
  excellent: 2,
  excited: 1,
  fantastic: 2,
  glad: 1,
  good: 1,
  great: 1,
  happy: 1,
  helpful: 1,
  impressed: 2,
  love: 2,
  loved: 2,
  perfect: 2,
  pleased: 1,
  resolved: 1,
  thank: 1,
  thanks: 1,
  thrilled: 2,
  wonderful: 2,
};

export const NEGATIVE_TERMS: Readonly<Record<string, number>> = {
  angry: 2,
  annoyed: 1,
  awful: 2,
  bad: 1,
  broken: 1,
  complaint: 2,
  confused: 1,
  disappointed: 2,
  disappointing: 2,
  error: 1,
  fail: 1,
  failed: 1,
  frustrated: 2,
  frustrating: 2,
  hate: 2,
  horrible: 2,
  issue: 1,
  late: 1,
  poor: 1,
  problem: 1,
  refund: 1,
  terrible: 2,
  unacceptable: 2,
  unhappy: 2,
  urgent: 1,
  worst: 2,
  wrong: 1,
};

export const NEGATION_TERMS: ReadonlySet<string> = new Set([
  "not",
  "no",
  "never",
  "hardly",
  "without",
  "isn't",
  "wasn't",
  "aren't",
  "don't",
  "doesn't",
  "didn't",
  "can't",
  "cannot",
  "couldn't",
  "won't",
  "wouldn't",
]);

export const INTENSIFIER_TERMS: ReadonlySet<string> = new Set([
  "very",
  "really",
  "extremely",
  "incredibly",
  "absolutely",
  "so",
  "truly",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token.length > 0);
}

interface ScanAccumulator {
  signals: SentimentSignal[];
  tokenCount: number;
  negationFlips: number;
  intensifierBoosts: number;
}

function scanSource(text: string, source: SignalSource, acc: ScanAccumulator): void {
  const tokens = tokenize(text);
  acc.tokenCount += tokens.length;
  const sourceMultiplier = source === "subject" ? SUBJECT_WEIGHT_MULTIPLIER : 1;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const positiveWeight = POSITIVE_TERMS[token];
    const negativeWeight = NEGATIVE_TERMS[token];
    if (positiveWeight === undefined && negativeWeight === undefined) {
      continue;
    }

    let polarity: SentimentSignal["polarity"] =
      positiveWeight !== undefined ? "positive" : "negative";
    const baseWeight = positiveWeight ?? negativeWeight ?? 0;

    let negated = false;
    for (let back = 1; back <= NEGATION_WINDOW && i - back >= 0; back += 1) {
      if (NEGATION_TERMS.has(tokens[i - back])) {
        negated = true;
        break;
      }
    }
    if (negated) {
      polarity = polarity === "positive" ? "negative" : "positive";
      acc.negationFlips += 1;
    }

    let weight = baseWeight * sourceMultiplier;
    if (i > 0 && INTENSIFIER_TERMS.has(tokens[i - 1])) {
      weight *= INTENSIFIER_MULTIPLIER;
      acc.intensifierBoosts += 1;
    }

    acc.signals.push({
      term: token,
      polarity,
      weight: roundTo(weight, 3),
      source,
      negated,
    });
  }
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function classify(score: number, positiveWeight: number, negativeWeight: number): SentimentLabel {
  if (positiveWeight === 0 && negativeWeight === 0) {
    return "neutral";
  }
  if (positiveWeight > 0 && negativeWeight > 0) {
    const ratio =
      Math.min(positiveWeight, negativeWeight) / Math.max(positiveWeight, negativeWeight);
    if (ratio >= MIXED_RATIO) {
      return "mixed";
    }
  }
  if (score >= NEUTRAL_BAND) {
    return "positive";
  }
  if (score <= -NEUTRAL_BAND) {
    return "negative";
  }
  return "neutral";
}

function deriveConfidence(totalMatches: number): SentimentConfidence {
  if (totalMatches >= 5) {
    return "high";
  }
  if (totalMatches >= 2) {
    return "medium";
  }
  return "low";
}

/** Clamp caller-supplied maxSignals into the supported range. */
export function resolveMaxSignals(maxSignals: number | undefined): number {
  if (maxSignals === undefined) {
    return DEFAULT_MAX_SIGNALS;
  }
  return Math.min(Math.max(Math.trunc(maxSignals), 1), MAX_SIGNALS_LIMIT);
}

/**
 * Analyze the sentiment of a message.
 *
 * Assumes input has already been validated and sanitized — use
 * safeAnalyzeSentiment from services/guards for untrusted callers.
 */
export function analyzeSentiment(
  input: SentimentAnalysisInput,
  options: SentimentAnalysisOptions = {},
): SentimentAnalysisResult {
  const acc: ScanAccumulator = {
    signals: [],
    tokenCount: 0,
    negationFlips: 0,
    intensifierBoosts: 0,
  };
  scanSource(input.subject, "subject", acc);
  scanSource(input.body, "body", acc);

  let positiveWeight = 0;
  let negativeWeight = 0;
  let positiveMatches = 0;
  let negativeMatches = 0;
  for (const signal of acc.signals) {
    if (signal.polarity === "positive") {
      positiveWeight += signal.weight;
      positiveMatches += 1;
    } else {
      negativeWeight += signal.weight;
      negativeMatches += 1;
    }
  }

  const totalWeight = positiveWeight + negativeWeight;
  const score = totalWeight === 0 ? 0 : roundTo((positiveWeight - negativeWeight) / totalWeight, 3);

  const stats: SentimentStats = {
    tokenCount: acc.tokenCount,
    positiveMatches,
    negativeMatches,
    negationFlips: acc.negationFlips,
    intensifierBoosts: acc.intensifierBoosts,
  };

  const includeSignals = options.includeSignals !== false;
  const signals = includeSignals
    ? [...acc.signals]
        .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
        .slice(0, resolveMaxSignals(options.maxSignals))
    : [];

  return {
    messageId: input.messageId,
    sentiment: classify(score, positiveWeight, negativeWeight),
    score,
    confidence: deriveConfidence(positiveMatches + negativeMatches),
    signals,
    stats,
  };
}
