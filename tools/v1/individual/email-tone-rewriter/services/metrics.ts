/**
 * Lightweight, deterministic metrics for rewrite results.
 *
 * No external calls; all counts are computed from the input/output text.
 */

export interface RewriteMetrics {
  wordCount: number;
  sentenceCount: number;
  characterCount: number;
  fillerRemoved: number;
  averageWordsPerSentence: number;
}

const FILLER_PATTERN = /\b(just|really|very|actually|basically|simply|obviously)\b/gi;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function countSentences(text: string): number {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim().length > 0);
  return sentences.length;
}

export function countCharacters(text: string): number {
  return text.trim().length;
}

export function countFillersRemoved(original: string, rewritten: string): number {
  const originalMatches = original.match(FILLER_PATTERN) || [];
  const rewrittenMatches = rewritten.match(FILLER_PATTERN) || [];
  return Math.max(0, originalMatches.length - rewrittenMatches.length);
}

export function averageWordsPerSentence(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  if (sentences === 0) {
    return 0;
  }
  return words / sentences;
}

export function computeMetrics(originalBody: string, rewrittenBody: string): RewriteMetrics {
  return {
    wordCount: countWords(rewrittenBody),
    sentenceCount: countSentences(rewrittenBody),
    characterCount: countCharacters(rewrittenBody),
    fillerRemoved: countFillersRemoved(originalBody, rewrittenBody),
    averageWordsPerSentence: averageWordsPerSentence(rewrittenBody),
  };
}
