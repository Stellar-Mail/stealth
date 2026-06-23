/**
 * useVendorTracker
 *
 * Local state hook for the Vendor Mail Tracker tool. Uses local fixture data
 * and in-memory state management — no backend calls are made here.
 *
 * Future integration: replace fixture initialization with a service call and
 * wire mutations to the relay/Stellar layer in a follow-up issue.
 */

import { useCallback, useMemo, useState } from "react";
import {
  FIXTURE_THREADS,
  FIXTURE_VENDORS,
  getFixtureStats,
} from "../fixtures";
import type {
  SortDir,
  SortField,
  ToolUIState,
  TrackingFilter,
  Vendor,
  VendorDraft,
  VendorThread,
  ThreadDraft,
  ViewMode,
} from "../types";

const DEFAULT_FILTER: TrackingFilter = {
  query: "",
  status: "all",
  priority: "all",
  category: "all",
  vendorId: "all",
};

export function useVendorTracker() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [vendors, setVendors] = useState<Vendor[]>(FIXTURE_VENDORS);
  const [threads, setThreads] = useState<VendorThread[]>(FIXTURE_THREADS);
  const [uiState, setUiState] = useState<ToolUIState>({ type: "ready" });

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // ── View ──────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filter, setFilter] = useState<TrackingFilter>(DEFAULT_FILTER);
  const [sortField, setSortField] = useState<SortField>("lastMessageAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [addThreadOpen, setAddThreadOpen] = useState(false);

  // ── Derived: filtered + sorted threads ───────────────────────────────────
  const filteredThreads = useMemo(() => {
    let result = threads;

    if (filter.vendorId !== "all") {
      result = result.filter((t) => t.vendorId === filter.vendorId);
    }
    if (filter.status !== "all") {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter.priority !== "all") {
      result = result.filter((t) => t.priority === filter.priority);
    }
    if (filter.category !== "all") {
      const vendorsInCat = vendors
        .filter((v) => v.category === filter.category)
        .map((v) => v.id);
      result = result.filter((t) => vendorsInCat.includes(t.vendorId));
    }
    if (filter.query.trim()) {
      const q = filter.query.toLowerCase();
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.excerpt.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          vendors
            .find((v) => v.id === t.vendorId)
            ?.name.toLowerCase()
            .includes(q),
      );
    }

    return [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "lastMessageAt":
          comparison =
            new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
          break;
        case "vendor": {
          const vA = vendors.find((v) => v.id === a.vendorId)?.name ?? "";
          const vB = vendors.find((v) => v.id === b.vendorId)?.name ?? "";
          comparison = vA.localeCompare(vB);
          break;
        }
        case "priority": {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          comparison = order[a.priority] - order[b.priority];
          break;
        }
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "followUpAt": {
          const aDate = a.followUpAt ? new Date(a.followUpAt).getTime() : Infinity;
          const bDate = b.followUpAt ? new Date(b.followUpAt).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [threads, filter, sortField, sortDir, vendors]);

  // ── Derived: selected items ────────────────────────────────────────────────
  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) ?? null,
    [vendors, selectedVendorId],
  );
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );
  const vendorThreads = useMemo(
    () =>
      selectedVendorId
        ? threads.filter((t) => t.vendorId === selectedVendorId)
        : filteredThreads,
    [selectedVendorId, threads, filteredThreads],
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => getFixtureStats(threads), [threads]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField],
  );

  const markThreadRead = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t)),
    );
  }, []);

  const resolveThread = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, status: "resolved" } : t)),
    );
  }, []);

  const addVendor = useCallback((draft: VendorDraft) => {
    const vendor: Vendor = {
      ...draft,
      id: `v-${Date.now()}`,
      threadCount: 0,
    };
    setVendors((prev) => [...prev, vendor]);
    setAddVendorOpen(false);
  }, []);

  const addThread = useCallback(
    (draft: ThreadDraft) => {
      const thread: VendorThread = {
        ...draft,
        id: `t-${Date.now()}`,
        messageCount: 1,
        lastMessageAt: new Date().toISOString(),
        unread: false,
      };
      setThreads((prev) => [...prev, thread]);
      // Update vendor threadCount
      setVendors((prev) =>
        prev.map((v) =>
          v.id === draft.vendorId
            ? { ...v, threadCount: v.threadCount + 1 }
            : v,
        ),
      );
      setAddThreadOpen(false);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilter(DEFAULT_FILTER);
  }, []);

  return {
    // Data
    vendors,
    threads,
    filteredThreads,
    vendorThreads,
    stats,
    uiState,
    // Selection
    selectedVendorId,
    selectedVendor,
    selectedThreadId,
    selectedThread,
    setSelectedVendorId,
    setSelectedThreadId,
    // View
    viewMode,
    setViewMode,
    filter,
    setFilter,
    sortField,
    sortDir,
    toggleSort,
    // Dialogs
    addVendorOpen,
    setAddVendorOpen,
    addThreadOpen,
    setAddThreadOpen,
    // Actions
    markThreadRead,
    resolveThread,
    addVendor,
    addThread,
    resetFilters,
  };
}

export type VendorTrackerHook = ReturnType<typeof useVendorTracker>;
