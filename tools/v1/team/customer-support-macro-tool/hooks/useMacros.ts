/**
 * Customer Support Macro Tool — useMacros Hook
 *
 * React hook wrapping the macro service and storage service.
 * Provides CRUD, search, and usage-tracking bound to local state + persistence.
 *
 * Isolation contract: do NOT import from src/. Future integration issues
 * will wire this hook into the main app via an adapter pattern.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Macro,
  type MacroCategory,
  type MacroCreateInput,
  type MacroSearchOptions,
  type MacroSortKey,
  type MacroUpdateInput,
  type SortDirection,
  createMacro,
  deleteMacro,
  interpolateMacro,
  recordMacroUsage,
  searchMacros,
  sortMacros,
  updateMacro,
  validateMacroInput,
  type MacroValidationError,
  type MacroVariableMap,
} from "../services/macro.service";
import {
  type StorageAdapter,
  localStorageAdapter,
  loadMacros,
  saveMacros,
} from "../services/storage.service";

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface UseMacrosOptions {
  /** Override the storage adapter (useful for tests). */
  storageAdapter?: StorageAdapter;
  /** Initial macros to seed when storage is empty. */
  seedMacros?: Macro[];
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseMacrosReturn {
  macros: Macro[];
  filteredMacros: Macro[];
  isLoading: boolean;
  searchOptions: MacroSearchOptions;
  sortKey: MacroSortKey;
  sortDirection: SortDirection;

  // CRUD
  addMacro: (input: MacroCreateInput) => Macro;
  editMacro: (id: string, changes: MacroUpdateInput) => void;
  removeMacro: (id: string) => void;
  toggleFavorite: (id: string) => void;

  // Usage
  useMacro: (id: string, variables?: MacroVariableMap) => string | null;

  // Search & sort
  setSearchOptions: (opts: Partial<MacroSearchOptions>) => void;
  setSortKey: (key: MacroSortKey) => void;
  setSortDirection: (dir: SortDirection) => void;

  // Validation
  validate: (input: Partial<MacroCreateInput>) => MacroValidationError[];
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useMacros(options: UseMacrosOptions = {}): UseMacrosReturn {
  const adapter = options.storageAdapter ?? localStorageAdapter;

  const [macros, setMacros] = useState<Macro[]>(() => {
    const stored = loadMacros(adapter);
    if (stored.length === 0 && options.seedMacros?.length) {
      return options.seedMacros;
    }
    return stored;
  });

  const [isLoading] = useState(false);
  const [searchOptions, setSearchOptionsState] = useState<MacroSearchOptions>({});
  const [sortKey, setSortKeyState] = useState<MacroSortKey>("updatedAt");
  const [sortDirection, setSortDirectionState] = useState<SortDirection>("desc");

  // Persist on change
  useEffect(() => {
    saveMacros(macros, adapter);
  }, [macros, adapter]);

  const filteredMacros = useMemo(() => {
    const searched = searchMacros(macros, searchOptions);
    return sortMacros(searched, sortKey, sortDirection);
  }, [macros, searchOptions, sortKey, sortDirection]);

  // --- CRUD ---

  const addMacro = useCallback((input: MacroCreateInput): Macro => {
    const macro = createMacro(input);
    setMacros((prev) => [macro, ...prev]);
    return macro;
  }, []);

  const editMacro = useCallback((id: string, changes: MacroUpdateInput) => {
    setMacros((prev) => prev.map((m) => (m.id === id ? updateMacro(m, changes) : m)));
  }, []);

  const removeMacro = useCallback((id: string) => {
    setMacros((prev) => deleteMacro(prev, id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setMacros((prev) =>
      prev.map((m) => (m.id === id ? updateMacro(m, { isFavorite: !m.isFavorite }) : m)),
    );
  }, []);

  // --- Usage ---

  const useMacro = useCallback(
    (id: string, variables: MacroVariableMap = {}): string | null => {
      const macro = macros.find((m) => m.id === id);
      if (!macro) return null;
      // Record usage
      setMacros((prev) => prev.map((m) => (m.id === id ? recordMacroUsage(m) : m)));
      return interpolateMacro(macro.body, variables);
    },
    [macros],
  );

  // --- Search & sort ---

  const setSearchOptions = useCallback((opts: Partial<MacroSearchOptions>) => {
    setSearchOptionsState((prev) => ({ ...prev, ...opts }));
  }, []);

  const setSortKey = useCallback((key: MacroSortKey) => {
    setSortKeyState(key);
  }, []);

  const setSortDirection = useCallback((dir: SortDirection) => {
    setSortDirectionState(dir);
  }, []);

  // --- Validation ---

  const validate = useCallback(
    (input: Partial<MacroCreateInput>): MacroValidationError[] => validateMacroInput(input),
    [],
  );

  return {
    macros,
    filteredMacros,
    isLoading,
    searchOptions,
    sortKey,
    sortDirection,
    addMacro,
    editMacro,
    removeMacro,
    toggleFavorite,
    useMacro,
    setSearchOptions,
    setSortKey,
    setSortDirection,
    validate,
  };
}

// Convenience re-export so consumers import from one place
export type { MacroCategory, Macro, MacroCreateInput, MacroUpdateInput };
