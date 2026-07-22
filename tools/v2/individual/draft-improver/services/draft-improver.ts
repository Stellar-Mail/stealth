import type {
  DraftAnalysis,
  DraftImproverResult,
  DraftInput,
  DraftMetrics,
  Suggestion,
} from "./types";

/** Words that usually add little meaning and can often be trimmed. */
const FILLER_WORDS: readonly string[] = [
  "just",
  "really",
  "very",
  "actually",
  "basically",
  "literally",
  "simply",
  "quite",
];

/** Hedging phrases that tend to weaken a message. */
const WEAK_PHRASES: readonly string[] = [
  "i think",
  "i guess",
  "sort of",
  "kind of",
  "sorry to bother",
  "just checking in",
];

/** Openings that count as a greeting when the draft starts with them. */
const GREETINGS: readonly string[] = [
  "hi",
  "hello",
  "hey",
  "dear",
  "good morning",
  "good afternoon",
  "good evening",
];

/** Phrases that count as a closing sign-off. */
const SIGN_OFFS: readonly string[] = [
  "regards",
  "best",
  "thanks",
  "thank you",
  "sincerely",
  "cheers",
];

const WORDS_PER_MINUTE = 200;
const RECOMMENDED_SUBJECT_MAX = 60;
const LONG_SENTENCE_WORDS = 25;
const VERY_LONG_SENTENCE_WORDS = 40;

const SEVERITY_PENALTY: Record<Suggestion["severity"], number> = {
  info: 0,
  suggestion: 5,
  warning: 12,
};

function toWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9']+/g);
  return matches === null ? [] : matches;
}

function toSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function countPhrases(loweredText: string, phrases: readonly string[]): number {
  let total = 0;
  for (const phrase of phrases) {
    let index = loweredText.indexOf(phrase);
    while (index !== -1) {
      total += 1;
      index = loweredText.indexOf(phrase, index + phrase.length);
    }
  }
  return total;
}

function countAdverbs(words: readonly string[]): number {
  let total = 0;
  for (const word of words) {
    if (word.length > 4 && word.endsWith("ly")) {
      total += 1;
    }
  }
  return total;
}

function countAllCapsWords(text: string): number {
  const tokens = text.match(/[A-Za-z]{3,}/g);
  if (tokens === null) {
    return 0;
  }
  let total = 0;
  for (const token of tokens) {
    if (token === token.toUpperCase()) {
      total += 1;
    }
  }
  return total;
}

function countExclamations(text: string): number {
  const matches = text.match(/!/g);
  return matches === null ? 0 : matches.length;
}

function startsWithGreeting(loweredBody: string): boolean {
  const start = loweredBody.slice(0, 40);
  return GREETINGS.some((greeting) => start.startsWith(greeting));
}

function containsSignOff(loweredBody: string): boolean {
  const tail = loweredBody.slice(-120);
  return SIGN_OFFS.some((signOff) => tail.includes(signOff));
}

function computeMetrics(body: string): DraftMetrics {
  const words = toWords(body);
  const sentences = toSentences(body);
  const paragraphs = toParagraphs(body);
  const loweredBody = body.toLowerCase();

  const sentenceWordCounts = sentences.map((sentence) => toWords(sentence).length);
  const longestSentenceWordCount = sentenceWordCounts.reduce(
    (max, count) => (count > max ? count : max),
    0,
  );

  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const averageWordsPerSentence =
    sentenceCount === 0 ? 0 : Math.round((wordCount / sentenceCount) * 10) / 10;
  const estimatedReadingTimeSeconds = Math.round((wordCount / WORDS_PER_MINUTE) * 60);
  const fillerWordCount = words.filter((word) => FILLER_WORDS.includes(word)).length;

  return {
    characterCount: body.length,
    wordCount,
    sentenceCount,
    paragraphCount: paragraphs.length,
    averageWordsPerSentence,
    longestSentenceWordCount,
    estimatedReadingTimeSeconds,
    fillerWordCount,
    weakPhraseCount: countPhrases(loweredBody, WEAK_PHRASES),
    adverbCount: countAdverbs(words),
    exclamationCount: countExclamations(body),
    allCapsWordCount: countAllCapsWords(body),
    hasGreeting: startsWithGreeting(loweredBody),
    hasSignOff: containsSignOff(loweredBody),
  };
}

function buildSuggestions(subject: string | undefined, metrics: DraftMetrics): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const trimmedSubject = subject === undefined ? "" : subject.trim();
  if (trimmedSubject.length === 0) {
    suggestions.push({
      id: "subject-missing",
      category: "structure",
      severity: "warning",
      message: "Add a subject line so recipients can scan and find the email.",
    });
  } else if (trimmedSubject.length > RECOMMENDED_SUBJECT_MAX) {
    suggestions.push({
      id: "subject-too-long",
      category: "length",
      severity: "suggestion",
      message: `Shorten the subject to ${RECOMMENDED_SUBJECT_MAX} characters or fewer so it is not truncated.`,
    });
  }

  if (!metrics.hasGreeting) {
    suggestions.push({
      id: "greeting-missing",
      category: "structure",
      severity: "suggestion",
      message: "Open with a short greeting to set a friendly tone.",
    });
  }

  if (!metrics.hasSignOff) {
    suggestions.push({
      id: "sign-off-missing",
      category: "structure",
      severity: "suggestion",
      message: "Close with a sign-off so the message feels complete.",
    });
  }

  if (metrics.longestSentenceWordCount >= VERY_LONG_SENTENCE_WORDS) {
    suggestions.push({
      id: "sentence-very-long",
      category: "clarity",
      severity: "warning",
      message: "Break up very long sentences to make the draft easier to read.",
      detail: `The longest sentence has ${metrics.longestSentenceWordCount} words.`,
    });
  } else if (metrics.averageWordsPerSentence > LONG_SENTENCE_WORDS) {
    suggestions.push({
      id: "sentences-long",
      category: "clarity",
      severity: "suggestion",
      message: "Aim for shorter sentences to improve readability.",
      detail: `Average sentence length is ${metrics.averageWordsPerSentence} words.`,
    });
  }

  if (metrics.fillerWordCount > 0) {
    suggestions.push({
      id: "filler-words",
      category: "clarity",
      severity: "suggestion",
      message: "Remove filler words to make the message more direct.",
      detail: `Found ${metrics.fillerWordCount} filler word(s).`,
    });
  }

  if (metrics.weakPhraseCount > 0) {
    suggestions.push({
      id: "weak-phrases",
      category: "tone",
      severity: "suggestion",
      message: "Replace hedging phrases with confident, direct wording.",
      detail: `Found ${metrics.weakPhraseCount} hedging phrase(s).`,
    });
  }

  if (metrics.exclamationCount > 2) {
    suggestions.push({
      id: "too-many-exclamations",
      category: "tone",
      severity: "suggestion",
      message: "Reduce exclamation marks to keep a professional tone.",
      detail: `Found ${metrics.exclamationCount} exclamation marks.`,
    });
  }

  if (metrics.allCapsWordCount > 0) {
    suggestions.push({
      id: "all-caps",
      category: "professionalism",
      severity: "warning",
      message: "Avoid ALL-CAPS words, which can read as shouting.",
      detail: `Found ${metrics.allCapsWordCount} all-caps word(s).`,
    });
  }

  if (metrics.wordCount < 10) {
    suggestions.push({
      id: "body-very-short",
      category: "length",
      severity: "suggestion",
      message: "Add more detail so the recipient has enough context to act.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "looks-good",
      category: "clarity",
      severity: "info",
      message: "No issues detected. This draft looks clear and ready to send.",
    });
  }

  return suggestions;
}

function computeScore(suggestions: readonly Suggestion[]): number {
  let score = 100;
  for (const suggestion of suggestions) {
    score -= SEVERITY_PENALTY[suggestion.severity];
  }
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * Analyse an email draft and return a score, metrics, and suggestions.
 *
 * The function is pure and synchronous: the same input always yields the same
 * result, and it performs no network or file access.
 */
export function improveDraft(input: DraftInput): DraftImproverResult {
  if (typeof input.body !== "string") {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "A draft with a string body is required.",
      },
    };
  }

  const body = input.body.trim();
  if (body.length === 0) {
    return {
      ok: false,
      error: { code: "EMPTY_DRAFT", message: "The draft body is empty." },
    };
  }

  const metrics = computeMetrics(body);
  const suggestions = buildSuggestions(input.subject, metrics);
  const analysis: DraftAnalysis = {
    score: computeScore(suggestions),
    metrics,
    suggestions,
  };
  return { ok: true, analysis };
}
