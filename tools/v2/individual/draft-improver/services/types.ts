/**
 * Type definitions for the Draft Improver core engine.
 *
 * Draft Improver is an isolated V2 tooling workspace. Nothing in this folder
 * imports from, or wires into, the main application. The engine is pure and
 * deterministic: the same input always produces the same output, and it makes
 * no network calls and reads no secrets or real user data.
 */

/** Raw draft supplied by a caller. */
export interface DraftInput {
  /** Optional subject line. */
  subject?: string;
  /** Draft body text. Required and expected to be non-empty. */
  body: string;
}

/** Broad grouping used to organise suggestions in a UI. */
export type SuggestionCategory = "clarity" | "tone" | "length" | "structure" | "professionalism";

/** How strongly a suggestion should be surfaced. */
export type SuggestionSeverity = "info" | "suggestion" | "warning";

/** A single, actionable improvement hint. */
export interface Suggestion {
  /** Stable identifier, useful as a UI key and for de-duplication. */
  id: string;
  category: SuggestionCategory;
  severity: SuggestionSeverity;
  /** Short, human-readable summary. */
  message: string;
  /** Optional longer explanation of why this was flagged. */
  detail?: string;
}

/** Deterministic measurements computed from a draft. */
export interface DraftMetrics {
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  longestSentenceWordCount: number;
  estimatedReadingTimeSeconds: number;
  fillerWordCount: number;
  weakPhraseCount: number;
  adverbCount: number;
  exclamationCount: number;
  allCapsWordCount: number;
  hasGreeting: boolean;
  hasSignOff: boolean;
}

/** Full analysis returned for a valid draft. */
export interface DraftAnalysis {
  /** Overall quality score from 0 (poor) to 100 (excellent). */
  score: number;
  metrics: DraftMetrics;
  suggestions: Suggestion[];
}

/** Reasons the engine can reject an input. */
export type DraftImproverErrorCode = "EMPTY_DRAFT" | "INVALID_INPUT";

export interface DraftImproverError {
  code: DraftImproverErrorCode;
  message: string;
}

/**
 * Result of a single improveDraft call.
 *
 * The engine is synchronous, so there is no "loading" result here; loading is
 * a concern for a future UI layer, which can show a spinner while it awaits the
 * (near-instant) call. Success and error states are modelled explicitly.
 */
export type DraftImproverResult =
  | { ok: true; analysis: DraftAnalysis }
  | { ok: false; error: DraftImproverError };
