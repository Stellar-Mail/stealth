/**
 * Customer Support Macro Tool — Local Storage Service
 *
 * Handles persistence of macros to localStorage (browser) or in-memory fallback.
 * Fully isolated from the main app — no imports from src/.
 *
 * Isolation contract: do NOT import from src/ or wire into app routing.
 */

import type { Macro } from "./macro.service";

const STORAGE_KEY = "csmt_macros_v1";

// ---------------------------------------------------------------------------
// Storage abstraction
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Production adapter backed by window.localStorage. */
export const localStorageAdapter: StorageAdapter = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or private-browsing restriction — fail silently.
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // no-op
    }
  },
};

/** In-memory adapter for tests and SSR environments. */
export function createInMemoryAdapter(initial: Record<string, string> = {}): StorageAdapter {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

// ---------------------------------------------------------------------------
// Persistence functions
// ---------------------------------------------------------------------------

/**
 * Loads macros from storage.
 * Returns an empty array on error or missing key.
 */
export function loadMacros(adapter: StorageAdapter = localStorageAdapter): Macro[] {
  const raw = adapter.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Macro[];
  } catch {
    return [];
  }
}

/**
 * Persists the macro list to storage.
 */
export function saveMacros(macros: Macro[], adapter: StorageAdapter = localStorageAdapter): void {
  adapter.setItem(STORAGE_KEY, JSON.stringify(macros));
}

/**
 * Clears all stored macros.
 */
export function clearMacros(adapter: StorageAdapter = localStorageAdapter): void {
  adapter.removeItem(STORAGE_KEY);
}
