// Sentiment Detector — typed execution contract.
//
// Backend-facing types for the sentiment-detector tool. These types define the
// stable, non-UI contract between callers (services, jobs, tests) and the
// detection engine. No presentation concerns belong here.

/** Overall sentiment classification for a message. */
export type SentimentLabel = "positive" | "negative" | "neutral" | "mixed";

/** How much trust callers should place in the classification. */
export type SentimentConfidence = "low" | "medium" | "high";

/** Polarity contributed by a single matched term. */
export type SignalPolarity = "positive" | "negative";

/** Which part of the message a signal was found in. */
export type SignalSource = "subject" | "body";

/** Input accepted by the detection engine. */
export interface SentimentAnalysisInput {
  /** Stable caller-supplied identifier echoed back in the result. */
  messageId: string;
  /** Message subject line. May be empty when the body is not. */
  subject: string;
  /** Plain-text message body. May be empty when the subject is not. */
  body: string;
  /** Optional sender address, kept for correlation only — never analyzed. */
  senderAddress?: string;
  /** Optional ISO 8601 timestamp of when the message was received. */
  receivedAt?: string;
  /**
   * Optional BCP 47 language tag. Only English ("en" or "en-*") is
   * supported; other values are rejected with "unsupported-language".
   */
  language?: string;
}

/** Tuning options for a single analysis call. */
export interface SentimentAnalysisOptions {
  /** Include per-term signals in the result. Defaults to true. */
  includeSignals?: boolean;
  /** Upper bound on returned signals (1–100). Defaults to 25. */
  maxSignals?: number;
}

/** One matched lexicon term and its contribution to the score. */
export interface SentimentSignal {
  /** The lexicon term that matched, lowercased. */
  term: string;
  /** Effective polarity after negation handling. */
  polarity: SignalPolarity;
  /** Effective weight after source and intensifier multipliers. */
  weight: number;
  /** Where the term was found. */
  source: SignalSource;
  /** True when a nearby negation flipped the term's base polarity. */
  negated: boolean;
}

/** Deterministic counters describing how the score was produced. */
export interface SentimentStats {
  /** Total tokens scanned across subject and body. */
  tokenCount: number;
  /** Matches contributing positive weight (after negation). */
  positiveMatches: number;
  /** Matches contributing negative weight (after negation). */
  negativeMatches: number;
  /** How many matches had their polarity flipped by a negation. */
  negationFlips: number;
  /** How many matches were boosted by an intensifier. */
  intensifierBoosts: number;
}

/** Successful analysis output. */
export interface SentimentAnalysisResult {
  /** Echo of the input messageId. */
  messageId: string;
  /** Overall classification. */
  sentiment: SentimentLabel;
  /** Normalized score in [-1, 1]; 0 means neutral or no evidence. */
  score: number;
  /** Trust level derived from the amount of matched evidence. */
  confidence: SentimentConfidence;
  /** Matched signals, strongest first, truncated to maxSignals. */
  signals: SentimentSignal[];
  /** Counters describing the analysis. */
  stats: SentimentStats;
}

/** Machine-readable failure codes for the safe entry point. */
export type SentimentErrorCode =
  | "invalid-input"
  | "invalid-options"
  | "input-too-large"
  | "empty-content"
  | "unsupported-language";

/** One validation problem, tied to a field when known. */
export interface SentimentIssue {
  code: SentimentErrorCode;
  /** Input field the issue applies to, when identifiable. */
  field?: string;
  message: string;
}

/** Discriminated result of the guarded entry point — never throws. */
export type SafeSentimentResult =
  | { status: "ok"; result: SentimentAnalysisResult }
  | {
      status: "error";
      code: SentimentErrorCode;
      message: string;
      issues: SentimentIssue[];
    };
