/**
 * index.ts — Suspicious Sender Watchlist
 *
 * Folder-local API surface. Exports all public types, service, hook,
 * fixtures, and UI components for future integration.
 *
 * Nothing in this file imports from the main app shell.
 */

// Types
export type {
  WatchlistEntry,
  AddEntryInput,
  UpdateRiskInput,
  WatchlistFilter,
  WatchlistMetrics,
  FetchState,
  RiskLevel,
  EntryStatus,
} from "./types";

// Service
export { createWatchlistService } from "./services/watchlist.service";
export type { WatchlistService, WatchlistServiceConfig } from "./services/watchlist.service";

// Non-UI execution contract
export { createWatchlistContract } from "./services/execution-contract";
export { WatchlistErrorCode, ok, fail } from "./contract";
export type {
  WatchlistContract,
  WatchlistContractInput,
  WatchlistContractOutput,
  WatchlistResult,
} from "./contract";

// Hook
export { useWatchlist } from "./hooks/use-watchlist";
export type { UseWatchlistReturn, UseWatchlistOptions } from "./hooks/use-watchlist";

// Fixtures
export {
  WATCHLIST_FIXTURES,
  ACTIVE_FIXTURES,
  HIGH_RISK_FIXTURES,
} from "./fixtures/watchlist.fixtures";

// UI Components
export {
  SuspiciousSenderWatchlist,
  WatchlistEmptyState,
  WatchlistErrorState,
  WatchlistList,
  WatchlistLoadingState,
  WatchlistEntry as WatchlistEntryCard,
} from "./components";
