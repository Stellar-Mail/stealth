/**
 * Customer Support Macro Tool — Core Service
 *
 * Pure business logic for CRUD operations on support macros.
 * No React dependency — fully unit-testable in isolation.
 *
 * Isolation contract: this module must NOT import from the main app.
 * Future integration is handled by a separate integration issue.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MacroCategory =
  "greeting" | "billing" | "technical" | "shipping" | "refund" | "general";

export interface Macro {
  id: string;
  title: string;
  body: string;
  category: MacroCategory;
  tags: string[];
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  usageCount: number;
  isFavorite: boolean;
}

export interface MacroStore {
  macros: Macro[];
}

export interface MacroCreateInput {
  title: string;
  body: string;
  category: MacroCategory;
  tags?: string[];
}

export interface MacroUpdateInput {
  title?: string;
  body?: string;
  category?: MacroCategory;
  tags?: string[];
  isFavorite?: boolean;
}

export type MacroSearchOptions = {
  query?: string;
  category?: MacroCategory;
  tags?: string[];
  favoritesOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a deterministic-looking id for local store usage. */
export function generateMacroId(): string {
  return `macro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Returns an ISO-8601 timestamp for the current moment. */
export function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Core CRUD functions
// ---------------------------------------------------------------------------

/**
 * Creates a new Macro from the provided input.
 * Does not mutate the store — returns the new macro for the caller to persist.
 */
export function createMacro(input: MacroCreateInput): Macro {
  const ts = now();
  return {
    id: generateMacroId(),
    title: input.title.trim(),
    body: input.body,
    category: input.category,
    tags: input.tags?.map((t) => t.trim().toLowerCase()) ?? [],
    createdAt: ts,
    updatedAt: ts,
    usageCount: 0,
    isFavorite: false,
  };
}

/**
 * Returns an updated macro with the applied changes.
 * Does not mutate the store.
 */
export function updateMacro(macro: Macro, changes: MacroUpdateInput): Macro {
  return {
    ...macro,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.body !== undefined ? { body: changes.body } : {}),
    ...(changes.category !== undefined ? { category: changes.category } : {}),
    ...(changes.tags !== undefined
      ? { tags: changes.tags.map((t) => t.trim().toLowerCase()) }
      : {}),
    ...(changes.isFavorite !== undefined ? { isFavorite: changes.isFavorite } : {}),
    updatedAt: now(),
  };
}

/**
 * Removes a macro from the store by id.
 * Returns the new list without mutating the input.
 */
export function deleteMacro(macros: Macro[], id: string): Macro[] {
  return macros.filter((m) => m.id !== id);
}

/**
 * Records a single usage of a macro (increments usageCount).
 * Returns the updated macro without mutating the input.
 */
export function recordMacroUsage(macro: Macro): Macro {
  return { ...macro, usageCount: macro.usageCount + 1, updatedAt: now() };
}

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------

/**
 * Filters the macro list according to the given options.
 * All criteria are ANDed together.
 */
export function searchMacros(macros: Macro[], opts: MacroSearchOptions): Macro[] {
  const query = opts.query?.toLowerCase().trim();

  return macros.filter((macro) => {
    // Text search across title, body, and tags
    if (query) {
      const haystack = [macro.title, macro.body, ...macro.tags].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    // Category filter
    if (opts.category && macro.category !== opts.category) return false;

    // Tags filter — macro must include ALL requested tags
    if (opts.tags && opts.tags.length > 0) {
      const macroTagSet = new Set(macro.tags);
      const match = opts.tags.every((t) => macroTagSet.has(t.toLowerCase()));
      if (!match) return false;
    }

    // Favorites filter
    if (opts.favoritesOnly && !macro.isFavorite) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type MacroSortKey = "title" | "usageCount" | "updatedAt" | "createdAt";
export type SortDirection = "asc" | "desc";

/**
 * Returns a sorted copy of the macro list.
 */
export function sortMacros(
  macros: Macro[],
  key: MacroSortKey,
  direction: SortDirection = "asc",
): Macro[] {
  const sorted = [...macros].sort((a, b) => {
    let cmp: number;
    if (key === "usageCount") {
      cmp = a.usageCount - b.usageCount;
    } else if (key === "title") {
      cmp = a.title.localeCompare(b.title);
    } else {
      cmp = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

export type MacroVariableMap = Record<string, string>;

/**
 * Replaces `{{variable_name}}` tokens in a macro body with the provided values.
 * Unknown variables are left as-is so the caller can identify them.
 */
export function interpolateMacro(body: string, variables: MacroVariableMap): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

/**
 * Extracts all `{{variable_name}}` tokens from a macro body.
 * Returns unique variable names in order of first appearance.
 */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const matches = body.matchAll(/\{\{(\w+)\}\}/g);
  for (const [, key] of matches) {
    seen.add(key);
  }
  return [...seen];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface MacroValidationError {
  field: "title" | "body" | "category";
  message: string;
}

/**
 * Validates macro create/update input.
 * Returns an array of errors; empty array means valid.
 */
export function validateMacroInput(input: Partial<MacroCreateInput>): MacroValidationError[] {
  const errors: MacroValidationError[] = [];

  if (!input.title || input.title.trim().length === 0) {
    errors.push({ field: "title", message: "Title is required." });
  } else if (input.title.trim().length > 120) {
    errors.push({ field: "title", message: "Title must be 120 characters or fewer." });
  }

  if (!input.body || input.body.trim().length === 0) {
    errors.push({ field: "body", message: "Body is required." });
  } else if (input.body.length > 4000) {
    errors.push({ field: "body", message: "Body must be 4,000 characters or fewer." });
  }

  const validCategories: MacroCategory[] = [
    "greeting",
    "billing",
    "technical",
    "shipping",
    "refund",
    "general",
  ];
  if (input.category && !validCategories.includes(input.category)) {
    errors.push({ field: "category", message: `Unknown category: ${input.category}.` });
  }

  return errors;
}
