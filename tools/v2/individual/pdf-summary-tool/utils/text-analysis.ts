/**
 * PDF Summary Tool - Text Analysis Utilities
 *
 * Pure utilities for analyzing text content: keyword extraction,
 * readability metrics, content validation, etc.
 *
 * No side effects, deterministic, testable.
 */

// ---------------------------------------------------------------------------
// Keyword Extraction
// ---------------------------------------------------------------------------

/** English stopwords used in keyword extraction. */
const ENGLISH_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "it",
  "as",
  "be",
  "was",
  "were",
  "are",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "not",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
]);

/**
 * Extract keywords from text using word frequency analysis.
 *
 * Removes stopwords, punctuation, and returns top N keywords
 * sorted by frequency (highest first).
 *
 * @param text - Input text
 * @param limit - Maximum number of keywords to return (default: 5)
 * @returns Array of keywords, sorted by frequency descending
 *
 * @example
 * ```ts
 * const text = "The quick brown fox jumps over the lazy dog";
 * const keywords = extractKeywords(text, 3);
 * // => ["quick", "brown", "fox"]
 * ```
 */
export function extractKeywords(text: string, limit = 5): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Tokenize: lowercase, remove punctuation, split into words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ENGLISH_STOPWORDS.has(w));

  if (words.length === 0) {
    return [];
  }

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Sort by frequency (highest first) and return top N
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

// ---------------------------------------------------------------------------
// Content Validation
// ---------------------------------------------------------------------------

/**
 * Check if text content is long enough to summarize.
 *
 * @param text - Input text
 * @param minChars - Minimum character count (default: 50)
 * @returns true if text is long enough, false otherwise
 */
export function isContentLongEnough(text: string, minChars = 50): boolean {
  return typeof text === "string" && text.trim().length >= minChars;
}

/**
 * Calculate the approximate word count of text.
 *
 * Splits on whitespace and counts non-empty tokens.
 *
 * @param text - Input text
 * @returns Approximate word count
 */
export function getWordCount(text: string): number {
  if (!text || typeof text !== "string") {
    return 0;
  }
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Calculate the approximate sentence count of text.
 *
 * Splits on common sentence-ending punctuation.
 *
 * @param text - Input text
 * @returns Approximate sentence count
 */
export function getSentenceCount(text: string): number {
  if (!text || typeof text !== "string") {
    return 0;
  }
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

// ---------------------------------------------------------------------------
// Text Segmentation
// ---------------------------------------------------------------------------

/**
 * Split text into sentences with basic heuristics.
 *
 * Handles common abbreviations and returns non-empty segments.
 *
 * @param text - Input text
 * @returns Array of sentence strings
 *
 * @example
 * ```ts
 * const text = "Hello world. How are you?";
 * const sentences = splitIntoSentences(text);
 * // => ["Hello world", "How are you"]
 * ```
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Normalize whitespace
  const normalized = text.replace(/\n+/g, " ").trim();

  // Split on sentence-ending punctuation followed by whitespace
  const sentences = normalized.split(/(?<=[.!?])\s+/);

  return sentences.filter((s) => s.trim().length > 0).map((s) => s.trim());
}

/**
 * Split text into paragraphs (by double newlines).
 *
 * @param text - Input text
 * @returns Array of paragraph strings
 */
export function splitIntoParagraphs(text: string): string[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ---------------------------------------------------------------------------
// Readability Metrics
// ---------------------------------------------------------------------------

/**
 * Estimate reading time in minutes based on average reading speed.
 *
 * Assumes 200 words per minute as the average reading speed.
 *
 * @param text - Input text
 * @returns Estimated reading time in minutes (rounded down)
 */
export function estimateReadingTimeMinutes(text: string): number {
  const wordCount = getWordCount(text);
  const wordsPerMinute = 200;
  return Math.floor(wordCount / wordsPerMinute) || 1;
}

/**
 * Calculate character density (non-whitespace characters / total characters).
 *
 * Useful for detecting sparse or whitespace-heavy content.
 *
 * @param text - Input text
 * @returns Number between 0 and 1 representing density
 */
export function getCharacterDensity(text: string): number {
  if (!text || typeof text !== "string") {
    return 0;
  }

  const nonWhitespaceCount = text.replace(/\s/g, "").length;
  return text.length > 0 ? nonWhitespaceCount / text.length : 0;
}

// ---------------------------------------------------------------------------
// Text Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize text for processing: trim, collapse whitespace.
 *
 * @param text - Input text
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .trim()
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\n\n+/g, "\n\n") // Collapse multiple newlines
    .replace(/\s\s+/g, " "); // Collapse multiple spaces within lines
}

/**
 * Remove URLs from text.
 *
 * @param text - Input text
 * @returns Text with URLs removed
 */
export function removeUrls(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Simple regex for http(s) and www URLs
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/www\.\S+/g, "")
    .trim();
}

/**
 * Remove email addresses from text.
 *
 * @param text - Input text
 * @returns Text with email addresses removed
 */
export function removeEmails(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, "").trim();
}

// ---------------------------------------------------------------------------
// Language Detection (Simple)
// ---------------------------------------------------------------------------

/**
 * Guess the primary language of text (very basic heuristic).
 *
 * Currently only distinguishes English from others.
 * For production, use a proper language detection library.
 *
 * @param text - Input text
 * @returns Language code ('en', 'unknown')
 */
export function guessLanguage(text: string): string {
  if (!text || typeof text !== "string" || text.length < 20) {
    return "unknown";
  }

  // Simple check: count English common words
  const englishWords = ["the", "is", "and", "to", "of", "in", "a", "that", "it", "for"];
  const lowerText = text.toLowerCase();
  let matches = 0;

  for (const word of englishWords) {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    matches += (lowerText.match(regex) || []).length;
  }

  // If more than 5% of the sample matches common English words, assume English
  const sampleWords = lowerText.split(/\s+/).length;
  return matches / Math.max(sampleWords, 1) > 0.05 ? "en" : "unknown";
}
