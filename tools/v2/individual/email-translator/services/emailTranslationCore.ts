/**
 * Email-aware translation core (#495).
 *
 * The existing TranslationService validates input and delegates to a provider,
 * but it treats the whole payload as a single opaque string. Real email bodies
 * are multi-line and contain quoted replies ("On ... wrote: > ...") that should
 * NOT be machine-translated (they are citations). This module is the
 * folder-local "core feature logic" for translating email content: it splits a
 * body into lines, translates only the non-quoted lines, and preserves quote
 * markers, blank lines, and signatures deterministically.
 *
 * Design constraints (per the issue):
 * - No live network calls: the provider is injectable and the default mock is
 *   deterministic; production wiring is a future integration issue.
 * - No main-app linking: this file imports only folder-local types/providers.
 * - Deterministic, pure given a provider; inputs/outputs/states are documented.
 */

import type { TranslationProvider } from "./translationProvider";
import { getTranslationProvider } from "./translationProvider";
import { getLanguageByCode, SUPPORTED_LANGUAGES } from "./languages";

export interface EmailTranslateOptions {
  sourceLanguage?: string;
  targetLanguage: string;
  /** Injectable provider (defaults to the folder-local mock). */
  provider?: TranslationProvider;
}

export type EmailTranslateResult =
  | {
      ok: true;
      translatedBody: string;
      /** Number of content lines that were sent for translation. */
      translatedLineCount: number;
      /** Number of quoted/blank lines preserved verbatim. */
      preservedLineCount: number;
      detectedLanguage?: string;
    }
  | {
      ok: false;
      code: "UNSUPPORTED_TARGET_LANGUAGE" | "UNSUPPORTED_SOURCE_LANGUAGE" | "EMPTY_BODY";
      message: string;
    };

export interface EmailTranslationCore {
  translateBody(body: string, options: EmailTranslateOptions): Promise<EmailTranslateResult>;
}

/** A line is a quoted citation if it begins (after optional whitespace) with '>'. */
function isQuoteLine(line: string): boolean {
  return /^\s*>/.test(line);
}

export function createEmailTranslationCore(
  defaultProvider?: TranslationProvider,
): EmailTranslationCore {
  const provider = defaultProvider ?? getTranslationProvider();

  async function translateBody(
    body: string,
    options: EmailTranslateOptions,
  ): Promise<EmailTranslateResult> {
    if (!body || body.trim().length === 0) {
      return { ok: false, code: "EMPTY_BODY", message: "Email body cannot be empty." };
    }
    if (!getLanguageByCode(options.targetLanguage)) {
      return {
        ok: false,
        code: "UNSUPPORTED_TARGET_LANGUAGE",
        message: `Target language '${options.targetLanguage}' is not supported.`,
      };
    }
    if (options.sourceLanguage && !getLanguageByCode(options.sourceLanguage)) {
      return {
        ok: false,
        code: "UNSUPPORTED_SOURCE_LANGUAGE",
        message: `Source language '${options.sourceLanguage}' is not supported.`,
      };
    }

    const lines = body.split(/\r?\n/);
    const out: string[] = [];
    let translatedLineCount = 0;
    let preservedLineCount = 0;
    let detectedLanguage: string | undefined;

    for (const line of lines) {
      if (line.trim().length === 0 || isQuoteLine(line)) {
        out.push(line); // preserve verbatim
        preservedLineCount += 1;
        continue;
      }
      const result = await provider.translate({
        text: line,
        sourceLanguage: options.sourceLanguage ?? "auto",
        targetLanguage: options.targetLanguage,
      });
      out.push(result.translatedText);
      translatedLineCount += 1;
      if (result.detectedLanguage) detectedLanguage = result.detectedLanguage;
    }

    return {
      ok: true,
      translatedBody: out.join("\n"),
      translatedLineCount,
      preservedLineCount,
      detectedLanguage,
    };
  }

  return { translateBody };
}

/** Public list of supported language codes (folder-local catalog). */
export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
