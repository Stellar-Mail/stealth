/**
 * Team Security Flagging Tool - Data Hook
 *
 * Custom hook for managing flag data fetching and mutations
 */

import { useState, useEffect, useCallback } from "react";
import type {
  SecurityFlag,
  FlagFilters,
  FlagSortOptions,
  CreateFlagFormData,
  UpdateFlagFormData,
  FlagListResponse,
} from "../types";
import { announce } from "../utils/accessibility";
import { SR_ANNOUNCEMENTS } from "../constants";

interface UseFlagDataOptions {
  filters?: FlagFilters;
  sort?: FlagSortOptions;
  pageSize?: number;
  autoLoad?: boolean;
}

interface UseFlagDataReturn {
  flags: SecurityFlag[];
  selectedFlag: SecurityFlag | null;
  isLoading: boolean;
  error: Error | null;
  total: number;
  page: number;
  hasMore: boolean;
  loadFlags: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectFlag: (flag: SecurityFlag | null) => void;
  createFlag: (data: CreateFlagFormData) => Promise<SecurityFlag>;
  updateFlag: (id: string, data: UpdateFlagFormData) => Promise<SecurityFlag>;
  deleteFlag: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Mock data generator for development
 * TODO: Replace with actual API calls
 */
function generateMockFlags(count: number = 10): SecurityFlag[] {
  const categories = ["phishing", "malware", "spam", "data-leak", "policy-violation"] as const;
  const severities = ["low", "medium", "high", "critical"] as const;
  const statuses = ["pending", "reviewing", "resolved", "dismissed"] as const;

  return Array.from({ length: count }, (_, i) => ({
    id: `flag-${i + 1}`,
    title: `Security Flag ${i + 1}`,
    description: `This is a detailed description of security flag ${i + 1}. It contains information about the potential security issue that needs to be addressed.`,
    category: categories[i % categories.length],
    severity: severities[i % severities.length],
    status: statuses[i % statuses.length],
    messageId: `msg-${i + 1}`,
    reportedBy: {
      id: `user-${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
    },
    createdAt: new Date(Date.now() - i * 86400000), // Days ago
    updatedAt: new Date(Date.now() - i * 43200000), // Half days ago
    tags: [`tag-${i % 3}`, `category-${i % 2}`],
  }));
}

/**
 * Simulate API delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom hook for managing flag data
 */
export function useFlagData(options: UseFlagDataOptions = {}): UseFlagDataReturn {
  const {
    filters = {},
    sort = { field: "createdAt", direction: "desc" },
    pageSize = 20,
    autoLoad = true,
  } = options;

  const [flags, setFlags] = useState<SecurityFlag[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<SecurityFlag | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  /**
   * Load flags from API
   */
  const loadFlags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    announce(SR_ANNOUNCEMENTS.loadingFlags);

    try {
      // Simulate API call
      await delay(500);

      // Generate mock data
      const mockFlags = generateMockFlags(pageSize);

      setFlags(mockFlags);
      setTotal(mockFlags.length);
      setPage(1);

      announce(SR_ANNOUNCEMENTS.filtersApplied(mockFlags.length));
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load flags");
      setError(error);
      announce(SR_ANNOUNCEMENTS.error(error.message), "assertive");
    } finally {
      setIsLoading(false);
      announce(SR_ANNOUNCEMENTS.loadingComplete);
    }
  }, [filters, sort, pageSize]);

  /**
   * Load more flags (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    announce(SR_ANNOUNCEMENTS.loadingFlags);

    try {
      await delay(500);

      const moreFlags = generateMockFlags(pageSize);
      setFlags((prev) => [...prev, ...moreFlags]);
      setPage((prev) => prev + 1);

      announce(`Loaded ${moreFlags.length} more flags`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load more flags");
      setError(error);
      announce(SR_ANNOUNCEMENTS.error(error.message), "assertive");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, pageSize]);

  /**
   * Select a flag
   */
  const selectFlag = useCallback((flag: SecurityFlag | null) => {
    setSelectedFlag(flag);
    if (flag) {
      announce(`Selected flag: ${flag.title}`);
    }
  }, []);

  /**
   * Create a new flag
   */
  const createFlag = useCallback(async (data: CreateFlagFormData): Promise<SecurityFlag> => {
    setIsLoading(true);
    setError(null);

    try {
      await delay(500);

      const newFlag: SecurityFlag = {
        id: `flag-${Date.now()}`,
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity,
        status: "pending",
        messageId: data.messageId,
        reportedBy: {
          id: "current-user",
          name: "Current User",
          email: "current@example.com",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: data.tags,
      };

      setFlags((prev) => [newFlag, ...prev]);
      setTotal((prev) => prev + 1);

      announce(SR_ANNOUNCEMENTS.flagCreated(newFlag.title));

      return newFlag;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create flag");
      setError(error);
      announce(SR_ANNOUNCEMENTS.error(error.message), "assertive");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update an existing flag
   */
  const updateFlag = useCallback(
    async (id: string, data: UpdateFlagFormData): Promise<SecurityFlag> => {
      setIsLoading(true);
      setError(null);

      try {
        await delay(500);

        const flagIndex = flags.findIndex((f) => f.id === id);
        if (flagIndex === -1) {
          throw new Error("Flag not found");
        }

        const updatedFlag: SecurityFlag = {
          ...flags[flagIndex],
          ...data,
          updatedAt: new Date(),
          assignedTo: typeof data.assignedTo === "object" && data.assignedTo !== null
            ? data.assignedTo
            : undefined,
        };

        setFlags((prev) => {
          const newFlags = [...prev];
          newFlags[flagIndex] = updatedFlag;
          return newFlags;
        });

        if (selectedFlag?.id === id) {
          setSelectedFlag(updatedFlag);
        }

        announce(SR_ANNOUNCEMENTS.flagUpdated(updatedFlag.title));

        return updatedFlag;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update flag");
        setError(error);
        announce(SR_ANNOUNCEMENTS.error(error.message), "assertive");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [flags, selectedFlag],
  );

  /**
   * Delete a flag
   */
  const deleteFlag = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await delay(500);

        const flag = flags.find((f) => f.id === id);
        if (!flag) {
          throw new Error("Flag not found");
        }

        setFlags((prev) => prev.filter((f) => f.id !== id));
        setTotal((prev) => prev - 1);

        if (selectedFlag?.id === id) {
          setSelectedFlag(null);
        }

        announce(SR_ANNOUNCEMENTS.flagDeleted(flag.title));
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to delete flag");
        setError(error);
        announce(SR_ANNOUNCEMENTS.error(error.message), "assertive");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [flags, selectedFlag],
  );

  /**
   * Refresh flags
   */
  const refresh = useCallback(async () => {
    await loadFlags();
  }, [loadFlags]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadFlags();
    }
  }, [autoLoad, loadFlags]);

  const hasMore = flags.length < total;

  return {
    flags,
    selectedFlag,
    isLoading,
    error,
    total,
    page,
    hasMore,
    loadFlags,
    loadMore,
    selectFlag,
    createFlag,
    updateFlag,
    deleteFlag,
    refresh,
  };
}
