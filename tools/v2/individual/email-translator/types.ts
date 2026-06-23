export type EmailTranslationStatus = "translated" | "needs-review" | "blocked";

export interface TranslatorLanguage {
  code: string;
  label: string;
  nativeLabel?: string;
}

export interface EmailTranslationResult {
  id: string;
  subject: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  status: EmailTranslationStatus;
  confidence: number;
  preservedElements: string[];
  warnings: string[];
}

export interface EmailTranslatorSummary {
  totalTranslations: number;
  translated: number;
  needsReview: number;
  blocked: number;
}
