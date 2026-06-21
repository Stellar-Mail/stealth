/**
 * watchlist.service.ts — Suspicious Sender Watchlist
 *
 * Pure service factory. No network calls, no secrets.
 * All state is held in memory and seeded from the local fixtures.
 *
 * Inputs:
 *   getEntries(filter?)      → WatchlistEntry[]
 *   addEntry(input)          → WatchlistEntry          (auto-generates id + dateAdded)
 *   updateRisk(input)        → WatchlistEntry          (throws if not found)
 *   dismissEntry(id)         → WatchlistEntry          (throws if not found)
 *   removeEntry(id)          → void                    (throws if not found)
 *   getMetrics()             → WatchlistMetrics
 *
 * Loading/error states are simulated via optional config flags.
 */

import type {
  AddEntryInput,
  UpdateRiskInput,
  WatchlistEntry,
  WatchlistFilter,
  WatchlistMetrics,
} from "../types";
import { WATCHLIST_FIXTURES } from "../fixtures/watchlist.fixtures";

let _idCounter = 100;
function generateId(): string {
  return `watch-${String(++_idCounter).padStart(3, "0")}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface WatchlistServiceConfig {
  /** Seed entries. Defaults to WATCHLIST_FIXTURES. */
  initialEntries?: WatchlistEntry[];
  /** Artificial delay in ms for async operations. Default 0. */
  delayMs?: number;
  /** Fraction [0–1] of calls that should randomly reject. Default 0. */
  failureRate?: number;
}

export function createWatchlistService(config: WatchlistServiceConfig = {}) {
  const { initialEntries = WATCHLIST_FIXTURES, delayMs = 0, failureRate = 0 } = config;

  // In-memory store — each call works against this list
  let entries: WatchlistEntry[] = initialEntries.map((e) => ({ ...e }));

  function delay(): Promise<void> {
    return delayMs > 0 ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve();
  }

  function maybeThrow(): void {
    if (Math.random() < failureRate) {
      throw new Error("Simulated service failure.");
    }
  }

  function applyFilter(list: WatchlistEntry[], filter: WatchlistFilter): WatchlistEntry[] {
    let result = list;
    if (filter.riskLevel) result = result.filter((e) => e.riskLevel === filter.riskLevel);
    if (filter.status) result = result.filter((e) => e.status === filter.status);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.senderEmail.toLowerCase().includes(q) ||
          e.senderName.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q),
      );
    }
    return result;
  }

  function computeMetrics(list: WatchlistEntry[]): WatchlistMetrics {
    return {
      total: list.length,
      highRisk: list.filter((e) => e.riskLevel === "high").length,
      mediumRisk: list.filter((e) => e.riskLevel === "medium").length,
      lowRisk: list.filter((e) => e.riskLevel === "low").length,
      active: list.filter((e) => e.status === "active").length,
      dismissed: list.filter((e) => e.status === "dismissed").length,
    };
  }

  /**
   * Returns all entries, optionally filtered.
   * Output: WatchlistEntry[]
   * Error state: rejects with Error when failureRate > 0 and unlucky roll.
   */
  async function getEntries(filter: WatchlistFilter = {}): Promise<WatchlistEntry[]> {
    await delay();
    maybeThrow();
    return applyFilter(entries, filter);
  }

  /**
   * Adds a new entry and returns it.
   * Output: WatchlistEntry with generated id and today's dateAdded.
   */
  async function addEntry(input: AddEntryInput): Promise<WatchlistEntry> {
    await delay();
    maybeThrow();
    const entry: WatchlistEntry = {
      id: generateId(),
      senderEmail: input.senderEmail,
      senderName: input.senderName,
      reason: input.reason,
      riskLevel: input.riskLevel,
      status: "active",
      dateAdded: today(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };
    entries = [...entries, entry];
    return entry;
  }

  /**
   * Updates the risk level of an existing entry.
   * Error state: throws if entry not found.
   */
  async function updateRisk(input: UpdateRiskInput): Promise<WatchlistEntry> {
    await delay();
    maybeThrow();
    const idx = entries.findIndex((e) => e.id === input.id);
    if (idx === -1) throw new Error(`Entry ${input.id} not found.`);
    const updated: WatchlistEntry = { ...entries[idx], riskLevel: input.riskLevel };
    entries = entries.map((e, i) => (i === idx ? updated : e));
    return updated;
  }

  /**
   * Marks an entry as dismissed.
   * Error state: throws if entry not found.
   */
  async function dismissEntry(id: string): Promise<WatchlistEntry> {
    await delay();
    maybeThrow();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Entry ${id} not found.`);
    const updated: WatchlistEntry = { ...entries[idx], status: "dismissed" };
    entries = entries.map((e, i) => (i === idx ? updated : e));
    return updated;
  }

  /**
   * Permanently removes an entry from the in-memory store.
   * Error state: throws if entry not found.
   */
  async function removeEntry(id: string): Promise<void> {
    await delay();
    maybeThrow();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Entry ${id} not found.`);
    entries = entries.filter((e) => e.id !== id);
  }

  /**
   * Returns aggregated metrics over all current entries.
   * Output: WatchlistMetrics
   */
  async function getMetrics(): Promise<WatchlistMetrics> {
    await delay();
    maybeThrow();
    return computeMetrics(entries);
  }

  return {
    getEntries,
    addEntry,
    updateRisk,
    dismissEntry,
    removeEntry,
    getMetrics,
    computeMetrics,
    applyFilter,
  };
}

export type WatchlistService = ReturnType<typeof createWatchlistService>;
