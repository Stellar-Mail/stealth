// Readability Improver — core analysis engine.
//
// Rule-based readability scoring and improvement suggestions over subject and
// body text. Pure and deterministic: no network calls, no mailbox access, no
// randomness, no clock reads, and no mutation of caller-supplied objects.

import type {
  IssueSource,
  ReadabilityGrade,
  ReadabilityInput,
  ReadabilityIssue,
  ReadabilityMetrics,
  ReadabilityOptions,
  ReadabilityResult,
} from "../types/readabilityImprover";

export const DEFAULT_MAX_ISSUES = 25;
export const MAX_ISSUES_LIMIT = 100;

/** Sentences above this word count read as long. */
export const LONG_SENTENCE_WORDS = 25;
/** Sentences above this word count are a strong readability drag. */
export const VERY_LONG_SENTENCE_WORDS = 40;
/** Paragraphs above this word count should be split. */
export const LONG_PARAGRAPH_WORDS = 100;
/** Words with at least this many syllables count as complex. */
export const COMPLEX_WORD_SYLLABLES = 3;
/** Excerpts are capped at this many characters. */
export const MAX_EXCERPT_CHARS = 80;

/** Wordy terms and their plain-language replacements. */
export const PLAIN_LANGUAGE_REPLACEMENTS: Readonly<Record<string, string>> = {
  additional: "more",
  approximately: "about",
  assistance: "help",
  commence: "start",
  demonstrate: "show",
  endeavor: "try",
  facilitate: "help",
  leverage: "use",
  numerous: "many",
  objective: "goal",
  prioritize: "rank",
  purchase: "buy",
  regarding: "about",
  subsequently: "later",
  sufficient: "enough",
  terminate: "end",
  utilize: "use",
  utilized: "used",
  utilizes: "uses",
};

const PASSIVE_VOICE_PATTERN = /\b(?:is|are|was|were|been|being|be)\s+[a-z]+ed\b/i;
const ALL_CAPS_WORD_PATTERN = /\b[A-Z]{4,}\b/g;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => /[a-zA-Z0-9]/.test(word));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => collapseWhitespace(paragraph))
    .filter((paragraph) => paragraph.length > 0);
}

/** Deterministic syllable estimate: vowel groups with a silent-e correction. */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) {
    return 0;
  }
  const groups = cleaned.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (cleaned.length > 2 && cleaned.endsWith("e") && !cleaned.endsWith("le")) {
    count -= 1;
  }
  return Math.max(count, 1);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function excerptOf(text: string): string {
  const collapsed = collapseWhitespace(text);
  if (collapsed.length <= MAX_EXCERPT_CHARS) {
    return collapsed;
  }
  const cut = collapsed.slice(0, MAX_EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function gradeFor(score: number): ReadabilityGrade {
  if (score >= 90) {
    return "very-easy";
  }
  if (score >= 70) {
    return "easy";
  }
  if (score >= 50) {
    return "medium";
  }
  if (score >= 30) {
    return "hard";
  }
  return "very-hard";
}

/** Clamp caller-supplied maxIssues into the supported range. */
export function resolveMaxIssues(maxIssues: number | undefined): number {
  if (maxIssues === undefined) {
    return DEFAULT_MAX_ISSUES;
  }
  return Math.min(Math.max(Math.trunc(maxIssues), 1), MAX_ISSUES_LIMIT);
}

function scanSentence(sentence: string, source: IssueSource, issues: ReadabilityIssue[]): void {
  const sentenceWords = words(sentence);

  if (sentenceWords.length > LONG_SENTENCE_WORDS) {
    const severity = sentenceWords.length > VERY_LONG_SENTENCE_WORDS ? "warn" : "info";
    issues.push({
      type: "long-sentence",
      severity,
      source,
      excerpt: excerptOf(sentence),
      suggestion: `Split this ${sentenceWords.length}-word sentence; aim for ${LONG_SENTENCE_WORDS} words or fewer.`,
    });
  }

  for (const word of sentenceWords) {
    const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
    const replacement = PLAIN_LANGUAGE_REPLACEMENTS[normalized];
    if (replacement !== undefined) {
      issues.push({
        type: "complex-word",
        severity: "info",
        source,
        excerpt: normalized,
        suggestion: `Replace "${normalized}" with "${replacement}".`,
      });
    }
  }

  if (PASSIVE_VOICE_PATTERN.test(sentence)) {
    issues.push({
      type: "passive-voice",
      severity: "info",
      source,
      excerpt: excerptOf(sentence),
      suggestion: "Rewrite in active voice: say who does the action.",
    });
  }

  const capsMatches = sentence.match(ALL_CAPS_WORD_PATTERN) ?? [];
  if (capsMatches.length >= 2) {
    issues.push({
      type: "shouting",
      severity: "warn",
      source,
      excerpt: excerptOf(sentence),
      suggestion: "Use sentence case; all-caps text reads as shouting.",
    });
  }
}

/**
 * Analyze the readability of a message and suggest improvements.
 *
 * Assumes input has already been validated and sanitized — use
 * safeImproveReadability from services/guards for untrusted callers.
 */
export function improveReadability(
  input: ReadabilityInput,
  options: ReadabilityOptions = {},
): ReadabilityResult {
  const subject = collapseWhitespace(input.subject);
  const paragraphs = splitParagraphs(input.body);

  const sources: Array<{ text: string; source: IssueSource }> = [];
  if (subject.length > 0) {
    sources.push({ text: subject, source: "subject" });
  }
  for (const paragraph of paragraphs) {
    sources.push({ text: paragraph, source: "body" });
  }

  const allIssues: ReadabilityIssue[] = [];
  let wordCount = 0;
  let sentenceCount = 0;
  let syllableCount = 0;
  let longSentenceCount = 0;
  let complexWordCount = 0;

  for (const { text, source } of sources) {
    const sentences = splitSentences(text);
    sentenceCount += sentences.length;
    for (const sentence of sentences) {
      const sentenceWords = words(sentence);
      wordCount += sentenceWords.length;
      if (sentenceWords.length > LONG_SENTENCE_WORDS) {
        longSentenceCount += 1;
      }
      for (const word of sentenceWords) {
        const syllables = countSyllables(word);
        syllableCount += syllables;
        if (syllables >= COMPLEX_WORD_SYLLABLES) {
          complexWordCount += 1;
        }
      }
      scanSentence(sentence, source, allIssues);
    }
    if (source === "body" && words(text).length > LONG_PARAGRAPH_WORDS) {
      allIssues.push({
        type: "long-paragraph",
        severity: "info",
        source,
        excerpt: excerptOf(text),
        suggestion: `Split this ${words(text).length}-word paragraph; aim for ${LONG_PARAGRAPH_WORDS} words or fewer.`,
      });
    }
  }

  // Flesch reading ease; empty text scores 0 rather than a division error.
  let score = 0;
  if (wordCount > 0 && sentenceCount > 0) {
    const raw = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
    score = roundTo(Math.min(Math.max(raw, 0), 100), 1);
  }

  const metrics: ReadabilityMetrics = {
    wordCount,
    sentenceCount,
    paragraphCount: paragraphs.length,
    averageWordsPerSentence: sentenceCount === 0 ? 0 : roundTo(wordCount / sentenceCount, 1),
    longSentenceCount,
    complexWordCount,
  };

  const includeIssues = options.includeIssues !== false;
  const maxIssues = resolveMaxIssues(options.maxIssues);
  const issues = includeIssues ? allIssues.slice(0, maxIssues) : [];
  const truncated = includeIssues && allIssues.length > maxIssues;

  return {
    messageId: input.messageId,
    score,
    grade: gradeFor(score),
    issues,
    metrics,
    stats: {
      issueCandidates: allIssues.length,
      issueCount: issues.length,
      truncated,
    },
  };
}
