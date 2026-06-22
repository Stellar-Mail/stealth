import { useState, useCallback, useEffect, useMemo } from "react";
import type { CalendarEvent, CalendarExtractionRequest, ExtractionFilter } from "../types";

/**
 * useCalendarEvents Hook
 *
 * Manages fetching, filtering, and sorting of calendar events locally.
 * Handles loading, error, and state management.
 */
interface UseCalendarEventsOptions {
  initialEvents?: CalendarEvent[];
  initialRequests?: CalendarExtractionRequest[];
  onFetch?: () => Promise<CalendarEvent[]>;
  onFetchRequests?: () => Promise<CalendarExtractionRequest[]>;
}

export function useCalendarEvents(options: UseCalendarEventsOptions = {}) {
  const [events, setEvents] = useState<CalendarEvent[]>(options.initialEvents || []);
  const [requests, setRequests] = useState<CalendarExtractionRequest[]>(
    options.initialRequests || [],
  );
  const [isLoading, setIsLoading] = useState(!options.initialEvents || !options.initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExtractionFilter>({});
  const [sortBy, setSortBy] = useState<"date" | "priority" | "category">("date");

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (options.onFetch) {
        const data = await options.onFetch();
        setEvents(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch events";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (options.onFetchRequests) {
        const data = await options.onFetchRequests();
        setRequests(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch extraction requests";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  // Fetch on mount if callbacks are provided
  useEffect(() => {
    if (options.onFetch && !options.initialEvents) {
      fetchEvents();
    }
    if (options.onFetchRequests && !options.initialRequests) {
      fetchRequests();
    }
  }, [
    options.onFetch,
    options.onFetchRequests,
    options.initialEvents,
    options.initialRequests,
    fetchEvents,
    fetchRequests,
  ]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (filter.dateFrom) {
      result = result.filter((e) => e.startDate >= filter.dateFrom!);
    }
    if (filter.dateTo) {
      result = result.filter((e) => e.startDate <= filter.dateTo!);
    }
    if (filter.categories && filter.categories.length > 0) {
      result = result.filter((e) => filter.categories!.includes(e.category));
    }
    if (filter.priorities && filter.priorities.length > 0) {
      result = result.filter((e) => filter.priorities!.includes(e.priority));
    }
    if (filter.status) {
      result = result.filter((e) => e.status === filter.status);
    }
    if (filter.attendees && filter.attendees.length > 0) {
      result = result.filter((e) => filter.attendees!.some((a) => e.attendees.includes(a)));
    }
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "priority": {
          const order = { urgent: 0, high: 1, normal: 2, low: 3 };
          return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
        }
        case "category": {
          return a.category.localeCompare(b.category);
        }
        case "date":
        default:
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      }
    });

    return result;
  }, [events, filter, sortBy]);

  const addEvent = useCallback((event: CalendarEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEventStatus = useCallback((id: string, status: CalendarEvent["status"]) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }, []);

  const addRequest = useCallback((request: CalendarExtractionRequest) => {
    setRequests((prev) => [...prev, request]);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchEvents(), fetchRequests()]);
  }, [fetchEvents, fetchRequests]);

  const clearFilter = useCallback(() => setFilter({}), []);

  return {
    events: filteredEvents,
    allEvents: events,
    requests,
    isLoading,
    error,
    filter,
    sortBy,
    setFilter,
    setSortBy,
    addEvent,
    removeEvent,
    updateEventStatus,
    addRequest,
    fetch: fetchEvents,
    fetchRequests,
    refresh,
    clearFilter,
  };
}

export type { UseCalendarEventsOptions };
