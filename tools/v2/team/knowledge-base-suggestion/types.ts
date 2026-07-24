/**
 * types.ts — Knowledge Base Suggestion (non-UI execution contract)
 *
 * Domain types for suggesting internal documentation articles. No imports from
 * the main app; presentation-free.
 *
 * @module Types
 */

// =============================================================================
// Core Domain Types
// =============================================================================

/** A knowledge base article. */
export interface KbArticle {
  id: string;
  title: string;
  /** Tags used for relevance matching. */
  tags: string[];
  /** Short summary shown to the user. */
  summary?: string;
  /** Full article content (optional, for content-based scoring). */
  content?: string;
  /** Category or section within the knowledge base. */
  category?: string;
  /** Locale code (e.g., "en", "fr"). */
  locale?: string;
  /** Access metadata (e.g., "public", "team", "restricted"). */
  access?: string;
  /** Product area this article relates to. */
  product?: string;
  /** Team that owns this article. */
  team?: string;
  /** Author or maintainer identifier. */
  author?: string;
  /** Date the article was last updated (ISO 8601). */
  updatedAt?: string;
  /** Version or revision identifier. */
  revision?: string;
  /** Whether this article is deprecated. */
  deprecated?: boolean;
  /** Related article IDs for cross-referencing. */
  relatedArticleIds?: string[];
  /** View count for popularity scoring. */
  viewCount?: number;
  /** User rating (0-5) for quality scoring. */
  rating?: number;
  /** Keyword frequency map for TF-IDF style scoring. */
  keywordFrequencies?: Record<string, number>;
}

/** A ranked suggestion. */
export interface KbSuggestion {
  articleId: string;
  title: string;
  summary?: string;
  /** Relevance score (higher = better). */
  score: number;
  /** Normalized confidence percentage (0-100). */
  confidence?: number;
  /** Category of the matched article. */
  category?: string;
}

/** Input for suggesting KB articles. */
export interface SuggestInput {
  /** Free-text query to match against the corpus. */
  query: string;
  /** Maximum number of suggestions to return. */
  limit?: number;
  /** Optional team or product context for filtering. */
  team?: string;
  /** Optional product context for filtering. */
  product?: string;
  /** Optional locale preference. */
  locale?: string;
  /** Optional categories to limit results to. */
  categories?: string[];
  /** Minimum confidence threshold (0-100). */
  minConfidence?: number;
}

// =============================================================================
// Scoring & Ranking Types
// =============================================================================

/** Supported ranking strategies. */
export enum RankingStrategy {
  /** Default: tag overlap + title keywords (existing). */
  Default = "default",
  /** Emphasis on tag overlap scoring. */
  TagWeighted = "tag-weighted",
  /** Emphasis on title and content keywords. */
  ContentWeighted = "content-weighted",
  /** Combined score with popularity bonus. */
  PopularityBoosted = "popularity-boosted",
  /** Combined score with recency bonus. */
  RecencyBoosted = "recency-boosted",
  /** Balanced scoring across all factors. */
  Balanced = "balanced",
}

/** Configuration for suggestion behavior. */
export interface SuggestionConfig {
  /** Ranking strategy to use. */
  strategy?: RankingStrategy;
  /** Score weight for tag matches (default: 2). */
  tagWeight?: number;
  /** Score weight for title matches (default: 1). */
  titleWeight?: number;
  /** Score weight for content matches (default: 0.5). */
  contentWeight?: number;
  /** Score weight for category matches (default: 1). */
  categoryWeight?: number;
  /** Bonus score for popular articles (view count dependent). */
  popularityWeight?: number;
  /** Bonus score for recently updated articles (days dependent). */
  recencyWeight?: number;
  /** Enable explainable match reasons in output. */
  includeReasons?: boolean;
  /** Default result limit if not specified. */
  defaultLimit?: number;
  /** Maximum allowed result limit. */
  maxLimit?: number;
}

/** Default suggestion configuration. */
export const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig = {
  strategy: RankingStrategy.Default,
  tagWeight: 2,
  titleWeight: 1,
  contentWeight: 0.5,
  categoryWeight: 1,
  popularityWeight: 0.3,
  recencyWeight: 0.2,
  includeReasons: true,
  defaultLimit: 5,
  maxLimit: 50,
};

// =============================================================================
// Match Reason Types
// =============================================================================

/** Match reason for explainability. */
export type KbMatchReason =
  | { type: "tag-match"; token: string; matchedValue: string }
  | { type: "title-keyword"; token: string; matchedValue: string }
  | { type: "content-keyword"; token: string; snippet: string }
  | { type: "category-match"; token: string; matchedValue: string }
  | { type: "popularity-bonus"; reason: string; bonus: number }
  | { type: "recency-bonus"; reason: string; bonus: number };

// =============================================================================
// Filter Types
// =============================================================================

/** A filter function applied to the corpus. */
export interface KbCorpusFilter {
  name: string;
  (article: KbArticle): boolean;
}

/** Result of corpus filtering with warnings. */
export interface KbCorpusFilterResult {
  /** Articles that passed all filters. */
  filtered: KbArticle[];
  /** Warnings about removed articles. */
  warnings: string[];
  /** Filter names that were applied. */
  appliedFilters: string[];
}

/** Predefined filter types. */
export enum FilterType {
  Access = "access",
  Locale = "locale",
  Team = "team",
  Product = "product",
  Category = "category",
  Deprecated = "deprecated",
  MinRating = "min-rating",
  Author = "author",
}

/** Configuration for a built-in filter. */
export interface FilterConfig {
  type: FilterType;
  /** Value to filter by (e.g., "public", "en", "security-team"). */
  value: string | number | boolean;
  /** Inclusive (keep matches) or exclusive (remove matches). */
  inclusive?: boolean;
}

// =============================================================================
// Cache Types
// =============================================================================

/** Cache entry for a suggestion result. */
export interface CacheEntry {
  /** The cached suggestion results. */
  suggestions: KbSuggestion[];
  /** When this entry was created (epoch ms). */
  timestamp: number;
  /** How long this entry is valid (ms). */
  ttl: number;
  /** Number of times this entry has been accessed. */
  hitCount: number;
  /** Query string that produced this result. */
  query: string;
  /** Corpus hash used for invalidation. */
  corpusHash: string;
  /** Size of original corpus at cache time. */
  corpusSize: number;
}

/** Configuration for the suggestion cache. */
export interface CacheConfig {
  /** Maximum number of entries in the cache. */
  maxEntries: number;
  /** Default TTL in milliseconds (default: 5 minutes). */
  defaultTtlMs: number;
  /** Whether auto-cleanup is enabled. */
  enableCleanup: boolean;
  /** Cleanup interval in milliseconds (default: 1 minute). */
  cleanupIntervalMs: number;
}

/** Default cache configuration. */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 100,
  defaultTtlMs: 300_000, // 5 minutes
  enableCleanup: true,
  cleanupIntervalMs: 60_000, // 1 minute
};

// =============================================================================
// Analytics Types
// =============================================================================

/** A logged analytics event for a suggestion interaction. */
export interface AnalyticsEvent {
  /** Unique event identifier. */
  id: string;
  /** Type of event. */
  type: AnalyticsEventType;
  /** Query that was used. */
  query: string;
  /** Article IDs that were suggested. */
  articleIds: string[];
  /** Whether the user selected a suggestion. */
  selected: boolean;
  /** Article ID the user selected (if any). */
  selectedArticleId?: string;
  /** Time taken for the suggestion request (ms). */
  latencyMs: number;
  /** Whether the result came from cache. */
  fromCache: boolean;
  /** Timestamp of the event. */
  timestamp: number;
  /** Optional user identifier. */
  userId?: string;
  /** Optional session identifier. */
  sessionId?: string;
}

/** Types of analytics events. */
export enum AnalyticsEventType {
  SuggestionRequested = "suggestion-requested",
  SuggestionDisplayed = "suggestion-displayed",
  SuggestionSelected = "suggestion-selected",
  SuggestionDismissed = "suggestion-dismissed",
  CacheHit = "cache-hit",
  CacheMiss = "cache-miss",
  Error = "error",
}

/** Aggregated analytics summary. */
export interface AnalyticsSummary {
  /** Total suggestion requests. */
  totalRequests: number;
  /** Number of requests with results. */
  requestsWithResults: number;
  /** Number of requests with no results. */
  requestsWithNoResults: number;
  /** Number of times a suggestion was selected. */
  totalSelections: number;
  /** Selection rate (0-1). */
  selectionRate: number;
  /** Average latency in ms. */
  averageLatencyMs: number;
  /** Cache hit rate (0-1). */
  cacheHitRate: number;
  /** Most frequent query terms. */
  topTerms: Array<{ term: string; count: number }>;
  /** Most suggested articles. */
  topArticles: Array<{ articleId: string; count: number }>;
  /** Most selected articles. */
  topSelectedArticles: Array<{ articleId: string; count: number }>;
  /** Error count. */
  errorCount: number;
  /** Time period start (epoch ms). */
  periodStart: number;
  /** Time period end (epoch ms). */
  periodEnd: number;
}

// =============================================================================
// Batch Operation Types
// =============================================================================

/** Input for batch suggestion operations. */
export interface BatchSuggestInput {
  /** Multiple queries to process. */
  queries: string[];
  /** Optional per-query limit. */
  limit?: number;
  /** Whether to deduplicate results across queries. */
  deduplicate?: boolean;
  /** Maximum total results across all queries. */
  maxTotalResults?: number;
}

/** Result of a batch suggestion operation. */
export interface BatchSuggestResult {
  /** Results keyed by query string. */
  results: Record<string, KbSuggestion[]>;
  /** Total number of queries processed. */
  totalQueries: number;
  /** Number of successful queries. */
  succeededQueries: number;
  /** Number of failed queries. */
  failedQueries: number;
  /** Errors keyed by query string. */
  errors: Record<string, string>;
  /** Total processing time in ms. */
  totalLatencyMs: number;
}

// =============================================================================
// Error Types
// =============================================================================

/** Detailed error payload for contract operations. */
export interface KbErrorPayload {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** Which field caused the error (if applicable). */
  field?: string;
  /** Detailed context about the error. */
  details?: string;
  /** Whether this error is recoverable. */
  recoverable?: boolean;
  /** Suggested action for the caller. */
  suggestedAction?: string;
}

// =============================================================================
// Service Configuration
// =============================================================================

/** Full configuration for the KB suggestion service. */
export interface KbServiceConfig {
  suggestion: SuggestionConfig;
  cache: CacheConfig;
  /** Whether analytics tracking is enabled. */
  analyticsEnabled: boolean;
  /** Maximum corpus size allowed. */
  maxCorpusSize: number;
  /** Whether to enable content-based scoring. */
  enableContentScoring: boolean;
  /** Whether to collect and return match reasons. */
  includeMatchReasons: boolean;
}

/** Default service configuration. */
export const DEFAULT_SERVICE_CONFIG: KbServiceConfig = {
  suggestion: DEFAULT_SUGGESTION_CONFIG,
  cache: DEFAULT_CACHE_CONFIG,
  analyticsEnabled: true,
  maxCorpusSize: 10_000,
  enableContentScoring: false,
  includeMatchReasons: true,
};
