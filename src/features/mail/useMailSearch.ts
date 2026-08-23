// ---------------------------------------------------------------------------
// Issue #1972 (BETA-065) — Typed Mailbox Search Hook
//
// Combines:
// - Debounced server search via /api/v1/search
// - Local client plaintext search across decrypted in-memory emails
// - User search history controls (add, remove, clear)
// - Filter pills / parameters state
// - Skeletons, loading states, empty states, offline/error recovery
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Email } from "@/components/mail/data";
import {
  sharedTypedApi as api,
  queryKeys,
  type SearchFilterQuery,
  type SearchIndexLimitationsDto,
  type SearchResponseDto,
  type SearchResultItemDto,
} from "@/lib/api";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  mergeSearchResults,
  removeSearchHistory,
  searchLocalEmails,
} from "./searchApi";
import { parseSearchQuery, type ParsedSearchQuery } from "./searchUtils";

export interface UseMailSearchOptions {
  actor: string | null;
  emails?: Email[];
  enabled?: boolean;
  debounceMs?: number;
  onSelectEmail?: (emailId: string, folder?: string) => void;
}

export function useMailSearch({
  actor,
  emails = [],
  enabled = true,
  debounceMs = 200,
  onSelectEmail,
}: UseMailSearchOptions) {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilterQuery>({});
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => getSearchHistory(actor));

  // Sync history on actor change
  useEffect(() => {
    setHistory(getSearchHistory(actor));
  }, [actor]);

  // Debounce the query string input
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [rawQuery, debounceMs]);

  const activeQueryString = debouncedQuery;
  const isQueryActive =
    Boolean(activeQueryString) || Object.values(filters).some((v) => v !== undefined);

  // Server metadata search query
  const serverSearchQuery = useQuery<SearchResponseDto, Error>({
    queryKey: queryKeys.search.query(actor ?? "anonymous", {
      q: activeQueryString,
      ...filters,
    }),
    queryFn: ({ signal }) =>
      api.search.search(
        {
          q: activeQueryString,
          ...filters,
        },
        signal,
      ),
    enabled: Boolean(actor) && enabled && isQueryActive,
    staleTime: 30_000,
  });

  // Local decrypted plaintext search results
  const localResults = useMemo(() => {
    if (!isQueryActive) return [];
    const parsed = parseSearchQuery(activeQueryString);
    const combinedParsed: ParsedSearchQuery = {
      ...parsed,
      filters: {
        ...parsed.filters,
        ...(filters.folder ? { folder: filters.folder as any } : {}),
        ...(filters.unread !== undefined ? { unread: filters.unread } : {}),
        ...(filters.starred !== undefined ? { starred: filters.starred } : {}),
        ...(filters.hasAttachments !== undefined ? { hasAttachments: filters.hasAttachments } : {}),
        ...(filters.sender ? { sender: filters.sender } : {}),
        ...(filters.recipient ? { recipient: filters.recipient } : {}),
        ...(filters.afterDate ? { afterDate: filters.afterDate } : {}),
        ...(filters.beforeDate ? { beforeDate: filters.beforeDate } : {}),
      },
    };
    return searchLocalEmails(emails, combinedParsed);
  }, [activeQueryString, filters, emails, isQueryActive]);

  // Merged results (local decrypted + server metadata)
  const results = useMemo<SearchResultItemDto[]>(() => {
    if (!isQueryActive) return [];
    const serverItems = serverSearchQuery.data?.items ?? [];
    return mergeSearchResults(serverItems, emails, activeQueryString);
  }, [isQueryActive, serverSearchQuery.data?.items, emails, activeQueryString]);

  const addHistory = useCallback(
    (q: string) => {
      const updated = addSearchHistory(actor, q);
      setHistory(updated);
    },
    [actor],
  );

  const removeHistory = useCallback(
    (q: string) => {
      const updated = removeSearchHistory(actor, q);
      setHistory(updated);
    },
    [actor],
  );

  const clearHistory = useCallback(() => {
    clearSearchHistory(actor);
    setHistory([]);
  }, [actor]);

  const handleSelectResult = useCallback(
    (item: SearchResultItemDto) => {
      if (rawQuery.trim()) {
        addHistory(rawQuery.trim());
      }
      setIsOpen(false);
      if (onSelectEmail) {
        onSelectEmail(item.id, item.folder);
      }
    },
    [rawQuery, addHistory, onSelectEmail],
  );

  const handleSelectHistoryItem = useCallback((queryText: string) => {
    setRawQuery(queryText);
    setDebouncedQuery(queryText);
  }, []);

  const serverLimitations: SearchIndexLimitationsDto | null =
    serverSearchQuery.data?.indexLimitations ?? null;

  return {
    rawQuery,
    setRawQuery,
    debouncedQuery,
    filters,
    setFilters,
    isOpen,
    setIsOpen,
    history,
    addHistory,
    removeHistory,
    clearHistory,
    results,
    localResults,
    serverResults: serverSearchQuery.data?.items ?? [],
    isLoading: isQueryActive && serverSearchQuery.isLoading,
    isFetching: serverSearchQuery.isFetching,
    isError: serverSearchQuery.isError,
    error: serverSearchQuery.error,
    retry: () => void serverSearchQuery.refetch(),
    serverLimitations,
    hasMore: serverSearchQuery.data?.hasMore ?? false,
    totalMatches: results.length,
    handleSelectResult,
    handleSelectHistoryItem,
  };
}
