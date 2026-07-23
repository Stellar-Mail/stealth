/**
 * Template placeholder analysis for the Email Template Library (#490).
 *
 * The library renders templates by substituting `{{ key }}` placeholders with
 * caller-supplied values. That works, but template AUTHORS have no way to know
 * whether a template is internally consistent before it ships:
 *
 * - A placeholder used in the subject/body but NOT declared in `variables` will
 *   render literally (the caller can never supply a value for it) — an authoring
 *   bug that render-time errors cannot surface because the caller does not know
 *   the key exists.
 * - A declared variable that is never referenced in the subject/body is dead
 *   metadata that clutters the render form.
 *
 * This module is a pure, folder-local analysis helper that reconciles the
 * placeholders actually referenced by a template against its declared variables.
 * It performs no I/O, makes no network calls, and is deterministic for a given
 * template.
 *
 * Inputs:  an `EmailTemplate` (or its `subject` + `body` + `variables`).
 * Outputs: an `EmailTemplateAnalysis` describing referenced keys, undeclared
 *          placeholders, unused declared variables, and an `isConsistent` flag.
 * Errors:  none thrown — malformed strings simply yield no placeholders.
 */

import type { EmailTemplate, TemplateVariable } from "../types/index.ts";

/** Matches `{{ key }}` placeholders; the key allows word chars, dot and dash. */
const PLACEHOLDER_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export interface EmailTemplateAnalysis {
  /** Unique placeholder keys referenced in subject/body, in first-seen order. */
  referencedKeys: string[];
  /** Declared variable keys, in declaration order. */
  declaredKeys: string[];
  /** Referenced keys that are NOT declared in `variables` (authoring errors). */
  undeclaredPlaceholders: string[];
  /** Declared keys that are never referenced in subject/body (dead metadata). */
  unusedVariables: string[];
  /**
   * True iff every referenced placeholder is declared. Unused declared
   * variables are a soft warning and do NOT make a template inconsistent.
   */
  isConsistent: boolean;
}

/** Extract unique `{{ key }}` placeholder keys from a string, in first-seen order. */
export function extractPlaceholders(text: string): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const match of Array.from(text.matchAll(PLACEHOLDER_PATTERN))) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Analyze a template's placeholders against its declared variables.
 *
 * Accepts either a full {@link EmailTemplate} or the minimal fields needed, so
 * it can be reused during authoring before a template object is finalized.
 */
export function analyzeTemplate(
  template: Pick<EmailTemplate, "subject" | "body" | "variables">,
): EmailTemplateAnalysis {
  const subject = typeof template.subject === "string" ? template.subject : "";
  const body = typeof template.body === "string" ? template.body : "";
  const variables: readonly TemplateVariable[] = Array.isArray(template.variables)
    ? template.variables
    : [];

  const referencedSeen = new Set<string>();
  const referencedKeys: string[] = [];
  for (const key of [...extractPlaceholders(subject), ...extractPlaceholders(body)]) {
    if (!referencedSeen.has(key)) {
      referencedSeen.add(key);
      referencedKeys.push(key);
    }
  }

  const declaredKeys: string[] = [];
  const declaredSet = new Set<string>();
  for (const variable of variables) {
    if (variable && typeof variable.key === "string" && !declaredSet.has(variable.key)) {
      declaredSet.add(variable.key);
      declaredKeys.push(variable.key);
    }
  }

  const undeclaredPlaceholders = referencedKeys.filter((key) => !declaredSet.has(key));
  const unusedVariables = declaredKeys.filter((key) => !referencedSeen.has(key));

  return {
    referencedKeys,
    declaredKeys,
    undeclaredPlaceholders,
    unusedVariables,
    isConsistent: undeclaredPlaceholders.length === 0,
  };
}
