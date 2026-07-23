// Email Translator Types

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedLanguage?: string;
  confidence?: number;
}

export interface TranslationError {
  code: string;
  message: string;
  details?: string;
}

export type TranslationState = "idle" | "detecting" | "translating" | "success" | "error";
