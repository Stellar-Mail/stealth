/**
 * index.ts — Knowledge Base Suggestion
 *
 * Folder-local API surface. Zero dependencies on the main app.
 */

// Types
export type {
  KbArticle,
  KbSuggestion,
  SuggestInput,
  KbMatchReason,
  KbCorpusFilter,
  KbCorpusFilterResult,
  SuggestionConfig,
  KbServiceConfig,
  CacheConfig,
  CacheEntry,
  AnalyticsEvent,
  AnalyticsSummary,
  KbErrorPayload,
  BatchSuggestInput,
  BatchSuggestResult,
  FilterConfig,
} from "./types";

export {
  RankingStrategy,
  AnalyticsEventType,
  FilterType,
  DEFAULT_SUGGESTION_CONFIG,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_SERVICE_CONFIG,
} from "./types";

// Core engine
export {
  KbErrorCode,
  ok,
  fail,
  tokenize,
  normalizeText,
  hashCorpus,
  hashQuery,
  suggestKb,
} from "./core/engine";

export type { KbResult, KbOperation, KbContractOutput, KbContract } from "./core/engine";

// Scoring
export { scoreArticle, computeScores, normalizeScore, daysSinceUpdate } from "./core/scoring";

// Ranking
export {
  rankArticles,
  applyRankingStrategy,
  deduplicateSuggestions,
  mergeSuggestionSets,
} from "./core/ranking";

export type { ScoredResult } from "./core/ranking";

// Filters
export {
  filterCorpus,
  buildFilter,
  buildFilters,
  filterByAccess,
  filterByLocale,
  filterByTeam,
  filterByProduct,
  filterByCategory,
  filterOutDeprecated,
  filterByMinRating,
} from "./core/filters";

// Validation
export {
  validateQuery,
  validateCorpus,
  validateLimit,
  validateConfig,
  validateInput,
  validateSuggestInputDetailed,
} from "./core/validation";

export type { ValidationError, ValidationResult } from "./core/validation";

// Cache
export { SuggestionCache, createNoOpCache } from "./core/cache";

// Analytics
export { AnalyticsCollector } from "./core/analytics";

// Service
export { createKbSuggestionService } from "./services/kb-suggestion.service";

// Fixtures
export {
  KB_ARTICLES,
  publicFilter,
  enLocaleFilter,
  excludeDeprecatedFilter,
  teamFilter,
  productFilter,
  minRatingFilter,
  generateLargeCorpus,
  tagWeightedConfig,
  contentWeightedConfig,
  popularityBoostedConfig,
  balancedConfig,
} from "./fixtures";
