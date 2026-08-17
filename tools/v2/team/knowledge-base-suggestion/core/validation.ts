/**
 * validation.ts — Knowledge Base Suggestion (input validation module)
 *
 * Pure input validation functions for the suggestion pipeline.
 * Supports query, corpus, configuration, and limit validation.
 * No imports from the main app.
 */

import type { KbArticle, SuggestInput, SuggestionConfig } from "../types";
import { DEFAULT_SUGGESTION_CONFIG } from "../types";

/**
 * Basic validation error interface.
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Full validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate query string.
 */
export function validateQuery(query: unknown): string | null {
  if (query === null || query === undefined) {
    return "query is required";
  }
  if (typeof query !== "string") {
    return "query must be a string";
  }
  if (query.trim().length === 0) {
    return "query must not be empty or whitespace only";
  }
  return null;
}

/**
 * Validate corpus array.
 */
export function validateCorpus(corpus: unknown): string | null {
  if (corpus === null || corpus === undefined) {
    return "corpus is required";
  }
  if (!Array.isArray(corpus)) {
    return "corpus must be an array";
  }
  return null;
}

/**
 * Validate limit parameter.
 */
export function validateLimit(limit: unknown, maxLimit: number = 50): string | null {
  if (limit === null || limit === undefined) return null; // optional
  if (typeof limit !== "number") {
    return "limit must be a number";
  }
  if (!Number.isInteger(limit)) {
    return "limit must be an integer";
  }
  if (limit < 1) {
    return "limit must be at least 1";
  }
  if (limit > maxLimit) {
    return `limit must not exceed ${maxLimit}`;
  }
  return null;
}

/**
 * Validate suggestion configuration.
 */
export function validateConfig(config: Partial<SuggestionConfig>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    errors.push({
      field: "config",
      message: "config must be an object",
      code: "INVALID_CONFIG",
    });
    return { valid: false, errors, warnings };
  }

  // Validate tagWeight
  if (config.tagWeight !== undefined) {
    if (typeof config.tagWeight !== "number" || config.tagWeight < 0) {
      errors.push({
        field: "tagWeight",
        message: "tagWeight must be a non-negative number",
        code: "INVALID_WEIGHT",
      });
    }
  }

  // Validate titleWeight
  if (config.titleWeight !== undefined) {
    if (typeof config.titleWeight !== "number" || config.titleWeight < 0) {
      errors.push({
        field: "titleWeight",
        message: "titleWeight must be a non-negative number",
        code: "INVALID_WEIGHT",
      });
    }
  }

  // Validate contentWeight
  if (config.contentWeight !== undefined) {
    if (typeof config.contentWeight !== "number" || config.contentWeight < 0) {
      errors.push({
        field: "contentWeight",
        message: "contentWeight must be a non-negative number",
        code: "INVALID_WEIGHT",
      });
    }
  }

  // Validate categoryWeight
  if (config.categoryWeight !== undefined) {
    if (typeof config.categoryWeight !== "number" || config.categoryWeight < 0) {
      errors.push({
        field: "categoryWeight",
        message: "categoryWeight must be a non-negative number",
        code: "INVALID_WEIGHT",
      });
    }
  }

  // Validate popularityWeight
  if (config.popularityWeight !== undefined) {
    if (typeof config.popularityWeight !== "number" || config.popularityWeight < 0) {
      errors.push({
        field: "popularityWeight",
        message: "popularityWeight must be a non-negative number",
        code: "INVALID_WEIGHT",
      });
    }
  }

  // Validate recencyWeight
  if (config.recencyWeight !== undefined) {
    if (typeof config.recencyWeight !== "number" || config.recencyWeight < 0) {
      errors.push({
        field: "recencyWeight",
        message: "recencyWeight must be a non-negative number",
        code: "INVALID_WEIGHT",
      });
    }
  }

  // Validate defaultLimit
  if (config.defaultLimit !== undefined) {
    const limitErr = validateLimit(
      config.defaultLimit,
      config.maxLimit ?? DEFAULT_SUGGESTION_CONFIG.maxLimit!,
    );
    if (limitErr) {
      errors.push({
        field: "defaultLimit",
        message: limitErr,
        code: "INVALID_LIMIT",
      });
    }
  }

  // Validate maxLimit
  if (config.maxLimit !== undefined) {
    const limitErr = validateLimit(config.maxLimit, 10000);
    if (limitErr) {
      errors.push({
        field: "maxLimit",
        message: limitErr,
        code: "INVALID_LIMIT",
      });
    } else if (config.defaultLimit !== undefined && config.defaultLimit > config.maxLimit) {
      warnings.push("defaultLimit exceeds maxLimit, will be clamped");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a complete SuggestInput against a corpus.
 *
 * @param input - The suggestion input
 * @param corpus - The article corpus
 * @param config - Optional suggestion configuration for limit validation
 * @returns Error message string or null if valid
 */
export function validateInput(
  input: SuggestInput,
  corpus: KbArticle[],
  config?: Partial<SuggestionConfig>,
): string | null {
  if (!input || typeof input !== "object") return "input is required";

  const queryErr = validateQuery(input.query);
  if (queryErr) return queryErr;

  const corpusErr = validateCorpus(corpus);
  if (corpusErr) return corpusErr;

  if (input.limit !== undefined) {
    const maxLimit = config?.maxLimit ?? DEFAULT_SUGGESTION_CONFIG.maxLimit!;
    const limitErr = validateLimit(input.limit, maxLimit);
    if (limitErr) return limitErr;
  }

  return null;
}

/**
 * Validate all fields on a SuggestInput, returning detailed errors.
 */
export function validateSuggestInputDetailed(input: unknown, corpus: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    errors.push({
      field: "input",
      message: "input is required and must be an object",
      code: "INVALID_INPUT",
    });
    return { valid: false, errors, warnings };
  }

  const typedInput = input as SuggestInput;

  const queryErr = validateQuery(typedInput.query);
  if (queryErr) {
    errors.push({
      field: "query",
      message: queryErr,
      code: "INVALID_QUERY",
    });
  }

  const corpusErr = validateCorpus(corpus);
  if (corpusErr) {
    errors.push({
      field: "corpus",
      message: corpusErr,
      code: "INVALID_CORPUS",
    });
  }

  if (typedInput.limit !== undefined) {
    const limitErr = validateLimit(typedInput.limit);
    if (limitErr) {
      errors.push({
        field: "limit",
        message: limitErr,
        code: "INVALID_LIMIT",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
