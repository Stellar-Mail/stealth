/**
 * types.ts — Client Priority Scoring (non-UI execution contract)
 *
 * Domain types for ranking clients by importance. No imports from the main
 * app; presentation-free.
 */

/** A weighted signal used to compute a client's priority score. */
export interface ClientSignal {
  /** Signal name, e.g. "revenue", "openTickets", "sentiment". */
  name: string;
  /** Numeric value for the signal. */
  value: number;
  /** Relative weight (>= 0). Higher weight = more influence on the score. */
  weight: number;
}

/** A client with the signals used for prioritization. */
export interface ClientForScoring {
  id: string;
  name: string;
  signals: ClientSignal[];
}

/** A scored + ranked client. */
export interface ScoredClient {
  id: string;
  name: string;
  /** Computed priority score (sum of value*weight across signals). */
  score: number;
  /** Derived priority band. */
  priority: "low" | "medium" | "high";
}

/** Input for scoring/ranking clients. */
export interface ScoreClientsInput {
  clients: ClientForScoring[];
  /** Score at/above which a client is "high" (default 10). */
  highThreshold?: number;
  /** Score below which a client is "low" (default 3). */
  lowThreshold?: number;
}

/** Options for ranking. */
export type PriorityOrder = "desc" | "asc";
