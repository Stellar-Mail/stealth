/**
 * Email Summarizer — core feature engine.
 *
 * Pure, deterministic logic that turns a single normalized email into a concise
 * summary plus a separate list of action items. No network calls, no mailbox
 * mutations, and no external AI providers: everything is derived locally from
 * the email body so the tool stays isolated and safe to review.
 */

export interface NormalizedEmail {
  subject: string;
  sender: string;
  receivedAt: string;
  body: string;
}

export interface SummarizerOptions {
  /** Maximum number of sentences kept in the narrative summary. */
  maxSentences?: number;
  /** Hard character cap for the narrative summary. */
  maxCharacters?: number;
}

export interface EmailSummarySource {
  subject: string;
  sender: string;
  receivedAt: string;
}

export interface EmailSummary {
  summary: string;
  actionItems: string[];
  sentenceCount: number;
  truncated: boolean;
  source: EmailSummarySource;
}

export type SummarizerErrorCode = "empty-body" | "unsupported-input";

export type SummarizerResult =
  | { status: "ok"; summary: EmailSummary }
  | { status: "error"; code: SummarizerErrorCode; message: string };

/** Lifecycle states a UI can render for an async summarize call. */
export type SummarizerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; summary: EmailSummary }
  | { status: "error"; code: SummarizerErrorCode; message: string };

export const DEFAULT_SUMMARIZER_OPTIONS: Required<SummarizerOptions> = {
  maxSentences: 3,
  maxCharacters: 280,
};

const ACTION_ITEM_MARKERS = [
  "please",
  "could you",
  "can you",
  "let me know",
  "make sure",
  "don't forget",
  "remember to",
  "need you to",
  "action required",
  "by tomorrow",
  "by end of day",
  "asap",
  "deadline",
];

function isNormalizedEmail(value: unknown): value is NormalizedEmail {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.subject === "string" &&
    typeof candidate.sender === "string" &&
    typeof candidate.receivedAt === "string" &&
    typeof candidate.body === "string"
  );
}

/** Deterministic sentence splitter. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Extracts action-item sentences separately from the narrative summary. */
export function extractActionItems(body: string): string[] {
  const items: string[] = [];
  for (const sentence of splitSentences(body)) {
    const normalized = sentence.toLowerCase();
    const isActionItem = ACTION_ITEM_MARKERS.some((marker) => normalized.includes(marker));
    if (isActionItem && !items.includes(sentence)) {
      items.push(sentence);
    }
  }
  return items;
}

function buildSummaryText(
  sentences: string[],
  options: Required<SummarizerOptions>,
): { summary: string; sentenceCount: number; truncated: boolean } {
  const selected = sentences.slice(0, options.maxSentences);
  let summary = selected.join(" ");
  let truncated = sentences.length > selected.length;

  if (summary.length > options.maxCharacters) {
    summary = `${summary.slice(0, Math.max(0, options.maxCharacters - 1)).trimEnd()}\u2026`;
    truncated = true;
  }

  return { summary, sentenceCount: selected.length, truncated };
}

function resolveOptions(options: SummarizerOptions): Required<SummarizerOptions> {
  return {
    maxSentences:
      options.maxSentences && options.maxSentences > 0
        ? Math.floor(options.maxSentences)
        : DEFAULT_SUMMARIZER_OPTIONS.maxSentences,
    maxCharacters:
      options.maxCharacters && options.maxCharacters > 0
        ? Math.floor(options.maxCharacters)
        : DEFAULT_SUMMARIZER_OPTIONS.maxCharacters,
  };
}

/**
 * Summarizes a single normalized email. Never throws: invalid input is reported
 * through a typed error result instead.
 */
export function summarizeEmail(
  input: NormalizedEmail,
  options: SummarizerOptions = {},
): SummarizerResult {
  if (!isNormalizedEmail(input)) {
    return {
      status: "error",
      code: "unsupported-input",
      message: "Expected a normalized email with subject, sender, receivedAt, and body.",
    };
  }

  const body = input.body.trim();
  if (body.length === 0) {
    return {
      status: "error",
      code: "empty-body",
      message: "Cannot summarize an email with an empty body.",
    };
  }

  const resolved = resolveOptions(options);
  const sentences = splitSentences(body);
  const actionItems = extractActionItems(body);
  const narrative = sentences.filter((sentence) => !actionItems.includes(sentence));
  const summarySource = narrative.length > 0 ? narrative : sentences;
  const { summary, sentenceCount, truncated } = buildSummaryText(summarySource, resolved);

  return {
    status: "ok",
    summary: {
      summary,
      actionItems,
      sentenceCount,
      truncated,
      source: {
        subject: input.subject,
        sender: input.sender,
        receivedAt: input.receivedAt,
      },
    },
  };
}

/** Maps a summarizer result into a UI-friendly ready/error state. */
export function toReadyState(result: SummarizerResult): SummarizerState {
  if (result.status === "error") {
    return { status: "error", code: result.code, message: result.message };
  }
  return { status: "ready", summary: result.summary };
}
