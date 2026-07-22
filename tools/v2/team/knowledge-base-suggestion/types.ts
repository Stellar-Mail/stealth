/**
 * types.ts — Knowledge Base Suggestion (non-UI execution contract)
 *
 * Domain types for suggesting internal documentation articles. No imports from
 * the main app; presentation-free.
 */

/** A knowledge base article. */
export interface KbArticle {
  id: string;
  title: string;
  /** Tags used for relevance matching. */
  tags: string[];
  /** Short summary shown to the user. */
  summary?: string;
}

/** A ranked suggestion. */
export interface KbSuggestion {
  articleId: string;
  title: string;
  summary?: string;
  /** Relevance score (higher = better). */
  score: number;
}

/** Input for suggesting KB articles. */
export interface SuggestInput {
  /** Free-text query to match against the corpus. */
  query: string;
  /** Maximum number of suggestions to return. */
  limit?: number;
}
