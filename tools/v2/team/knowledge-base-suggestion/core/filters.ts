/**
 * filters.ts — Knowledge Base Suggestion (corpus filter module)
 *
 * Pure filtering functions for the KB corpus.
 * Supports built-in filters and pluggable custom filters with warnings.
 * No imports from the main app.
 */

import type { KbArticle, KbCorpusFilter, KbCorpusFilterResult, FilterConfig } from "../types";
import { FilterType } from "../types";

/**
 * Filter corpus using optional contributor-provided filter functions.
 * Expandable: add new filter criteria without touching core logic.
 *
 * @param corpus - Array of articles to filter
 * @param filters - Array of filter functions to apply sequentially
 * @returns Filtered corpus with warnings about removed articles
 */
export function filterCorpus(
  corpus: KbArticle[],
  filters: KbCorpusFilter[] = [],
): KbCorpusFilterResult {
  if (!Array.isArray(corpus)) {
    return {
      filtered: [],
      warnings: ["corpus must be an array"],
      appliedFilters: [],
    };
  }

  if (corpus.length === 0) {
    return {
      filtered: [],
      warnings: [],
      appliedFilters: [],
    };
  }

  let working = [...corpus];
  const warnings: string[] = [];
  const appliedFilters: string[] = [];

  for (const filter of filters) {
    if (typeof filter !== "function") {
      warnings.push("Skipping invalid filter (not a function)");
      continue;
    }
    const before = working.length;
    working = working.filter(filter);
    const removed = before - working.length;
    appliedFilters.push(filter.name || "unnamed");
    if (removed > 0) {
      warnings.push(`Filter '${filter.name || "unnamed"}' removed ${removed} article(s)`);
    }
  }

  return {
    filtered: working,
    warnings,
    appliedFilters,
  };
}

/**
 * Helper to create a named filter function without Object.assign.
 */
function createFilter(fn: (article: KbArticle) => boolean, name: string): KbCorpusFilter {
  Object.defineProperty(fn, "name", { value: name, configurable: true });
  return fn as KbCorpusFilter;
}

/**
 * Build a corpus filter from a FilterConfig.
 *
 * @param config - The filter configuration
 * @returns A KbCorpusFilter function
 */
export function buildFilter(config: FilterConfig): KbCorpusFilter {
  const filterName = `${config.type}-${String(config.value)}`;
  const inclusive = config.inclusive !== false; // default to inclusive

  switch (config.type) {
    case FilterType.Access: {
      return createFilter((article: KbArticle) => {
        const matches = article.access === config.value;
        return inclusive ? matches : !matches;
      }, filterName);
    }

    case FilterType.Locale: {
      return createFilter((article: KbArticle) => {
        const matches = article.locale === config.value;
        return inclusive ? matches : !matches;
      }, filterName);
    }

    case FilterType.Team: {
      return createFilter((article: KbArticle) => {
        const matches = article.team === config.value;
        return inclusive ? matches : !matches;
      }, filterName);
    }

    case FilterType.Product: {
      return createFilter((article: KbArticle) => {
        const matches = article.product === config.value;
        return inclusive ? matches : !matches;
      }, filterName);
    }

    case FilterType.Category: {
      return createFilter((article: KbArticle) => {
        const matches = article.category === config.value;
        return inclusive ? matches : !matches;
      }, filterName);
    }

    case FilterType.Deprecated: {
      const keepDeprecated = Boolean(config.value);
      return createFilter((article: KbArticle) => {
        const matches = article.deprecated === true;
        return keepDeprecated ? matches : !matches;
      }, filterName);
    }

    case FilterType.MinRating: {
      const minRating = Number(config.value);
      return createFilter((article: KbArticle) => {
        const rating = article.rating ?? 0;
        return rating >= minRating;
      }, filterName);
    }

    case FilterType.Author: {
      return createFilter((article: KbArticle) => {
        const matches = article.author === config.value;
        return inclusive ? matches : !matches;
      }, filterName);
    }

    default: {
      // Unknown filter type — pass-through with warning
      return createFilter((_article: KbArticle) => true, `unknown-${config.type}`);
    }
  }
}

/**
 * Build multiple filters from an array of filter configs.
 */
export function buildFilters(configs: FilterConfig[]): KbCorpusFilter[] {
  return configs.map((config) => buildFilter(config));
}

/**
 * Filter corpus by access level.
 */
export function filterByAccess(access: string, inclusive: boolean = true): KbCorpusFilter {
  return buildFilter({ type: FilterType.Access, value: access, inclusive });
}

/**
 * Filter corpus by locale.
 */
export function filterByLocale(locale: string, inclusive: boolean = true): KbCorpusFilter {
  return buildFilter({ type: FilterType.Locale, value: locale, inclusive });
}

/**
 * Filter corpus by team.
 */
export function filterByTeam(team: string, inclusive: boolean = true): KbCorpusFilter {
  return buildFilter({ type: FilterType.Team, value: team, inclusive });
}

/**
 * Filter corpus by product.
 */
export function filterByProduct(product: string, inclusive: boolean = true): KbCorpusFilter {
  return buildFilter({ type: FilterType.Product, value: product, inclusive });
}

/**
 * Filter corpus by category.
 */
export function filterByCategory(category: string, inclusive: boolean = true): KbCorpusFilter {
  return buildFilter({ type: FilterType.Category, value: category, inclusive });
}

/**
 * Filter out deprecated articles.
 */
export function filterOutDeprecated(): KbCorpusFilter {
  return buildFilter({ type: FilterType.Deprecated, value: false });
}

/**
 * Filter articles with a minimum rating.
 */
export function filterByMinRating(minRating: number): KbCorpusFilter {
  return buildFilter({ type: FilterType.MinRating, value: minRating });
}
