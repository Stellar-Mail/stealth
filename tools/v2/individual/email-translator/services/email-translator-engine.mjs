export const EMAIL_TRANSLATOR_LANGUAGES = Object.freeze([
  "auto",
  "english",
  "spanish",
  "french",
  "german",
  "japanese",
  "korean",
  "chinese",
]);

export const EMAIL_TRANSLATOR_MAX_CHARS = 12000;

const warningPatterns = [
  ["links", /https?:\/\/|www\./i],
  ["dates", /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/],
  ["currency", /[$€£¥]\s?\d|\b(?:usd|eur|gbp|jpy|cny|xlm|usdc)\b/i],
  ["numbers", /\b\d+(?:[.,]\d+)?\b/],
];

function cleanText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLanguage(value, fallback) {
  const normalized = cleanText(value || fallback).toLowerCase();
  return EMAIL_TRANSLATOR_LANGUAGES.includes(normalized) ? normalized : fallback;
}

function stableJobId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `email-translation-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function detectTranslationWarnings(sourceText) {
  const text = cleanText(sourceText);
  return warningPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([warning]) => warning);
}

export function normalizeTranslatorInput(input = {}) {
  const sourceText = cleanText(input.sourceText);
  const sourceLanguage = normalizeLanguage(input.sourceLanguage, "auto");
  const targetLanguage = normalizeLanguage(input.targetLanguage, "english");
  const preserveTone = input.preserveTone !== false;

  if (!sourceText) {
    return {
      ok: false,
      error: "empty_source",
      message: "Email text is required before creating a translation job.",
    };
  }

  if (sourceText.length > EMAIL_TRANSLATOR_MAX_CHARS) {
    return {
      ok: false,
      error: "source_too_large",
      message: `Email text must be ${EMAIL_TRANSLATOR_MAX_CHARS} characters or fewer.`,
    };
  }

  if (sourceLanguage !== "auto" && sourceLanguage === targetLanguage) {
    return {
      ok: false,
      error: "same_language",
      message: "Source and target languages must be different.",
    };
  }

  return {
    ok: true,
    value: {
      sourceText,
      sourceLanguage,
      targetLanguage,
      preserveTone,
    },
  };
}

export function createTranslationJob(input = {}) {
  const normalized = normalizeTranslatorInput(input);

  if (!normalized.ok) {
    return {
      status: "error",
      error: normalized.error,
      message: normalized.message,
    };
  }

  const { sourceText, sourceLanguage, targetLanguage, preserveTone } = normalized.value;
  const warnings = detectTranslationWarnings(sourceText);
  const sourcePreview =
    sourceText.length > 180 ? `${sourceText.slice(0, 180).trim()}...` : sourceText;

  return {
    status: "ready",
    job: {
      id: stableJobId(`${sourceLanguage}:${targetLanguage}:${preserveTone}:${sourceText}`),
      sourceLanguage,
      targetLanguage,
      preserveTone,
      sourcePreview,
      characterCount: sourceText.length,
      warnings,
      requestedSteps: [
        "detect source language when set to auto",
        "translate body copy only",
        "preserve names, dates, links, amounts, and signatures",
        preserveTone ? "preserve sender tone" : "use neutral tone",
      ],
    },
  };
}

export function buildTranslationDraft(job, translatedText) {
  if (!job || typeof job !== "object") {
    throw new TypeError("A translation job is required.");
  }

  const cleanTranslation = cleanText(translatedText);

  return {
    status: cleanTranslation ? "success" : "empty",
    jobId: job.id,
    targetLanguage: job.targetLanguage,
    translatedText: cleanTranslation,
    reviewChecklist: [
      "verify recipient name and greeting",
      "verify dates, amounts, links, and product names",
      "review legal, medical, or financial language before sending",
      job.preserveTone ? "confirm translated tone matches the source" : "confirm neutral tone is acceptable",
    ],
  };
}
