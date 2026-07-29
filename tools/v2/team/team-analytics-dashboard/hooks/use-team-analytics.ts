import { useState, useMemo, useCallback } from "react";
import type {
  DashboardReport,
  AnalyticsSnapshot,
  MemberStatus,
  SnapshotStatus,
} from "../contract/analytics-contract";
import type { SortColumn } from "../components/MemberTable";
import { sampleDashboardReport, sampleAnalyticsSnapshots } from "../fixtures";

export interface UseTeamAnalyticsOptions {
  initialReport?: DashboardReport | null;
  initialSnapshots?: AnalyticsSnapshot[] | null;
  initialLoading?: boolean;
  initialError?: string | null;
  onRetry?: () => void;
}

export function useTeamAnalytics(options: UseTeamAnalyticsOptions = {}) {
  const [report, setReport] = useState<DashboardReport | null>(
    options.initialReport !== undefined ? options.initialReport : sampleDashboardReport,
  );
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[] | null>(
    options.initialSnapshots !== undefined ? options.initialSnapshots : sampleAnalyticsSnapshots,
  );
  const [loading, setLoading] = useState<boolean>(options.initialLoading || false);
  const [error, setError] = useState<string | null>(options.initialError || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"members" | "snapshots">("members");
  const [statusFilter, setStatusFilter] = useState<"all" | MemberStatus>("all");
  const [snapshotStatusFilter, setSnapshotStatusFilter] = useState<"all" | SnapshotStatus>("all");
  const [reviewRequiredOnly, setReviewRequiredOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortColumn>("memberId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("asc");
      }
    },
    [sortBy],
  );

  const handleClearFilters = useCallback(() => {
    setStatusFilter("all");
    setSnapshotStatusFilter("all");
    setReviewRequiredOnly(false);
    setSearchQuery("");
  }, []);

  const handleLoadSampleFixtures = useCallback(() => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Synchronous fixture load
    setReport(sampleDashboardReport);
    setSnapshots(sampleAnalyticsSnapshots);
    setLoading(false);
    setSuccessMessage("Sample team analytics loaded successfully.");
  }, []);

  const handleRefresh = useCallback(() => {
    if (options.onRetry) {
      options.onRetry();
    } else {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      setTimeout(() => {
        setReport(sampleDashboardReport);
        setSnapshots(sampleAnalyticsSnapshots);
        setLoading(false);
        setSuccessMessage("Team analytics refreshed.");
      }, 300);
    }
  }, [options]);

  const handleDismissSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  const filteredMembers = useMemo(() => {
    if (!report?.members) return [];

    return report.members.filter((member) => {
      if (statusFilter !== "all" && member.status !== statusFilter) {
        return false;
      }
      if (reviewRequiredOnly && member.slaBreaches === 0) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = member.memberId.toLowerCase().includes(query);
        const matchesName = member.name ? member.name.toLowerCase().includes(query) : false;
        if (!matchesId && !matchesName) return false;
      }
      return true;
    });
  }, [report?.members, statusFilter, reviewRequiredOnly, searchQuery]);

  const sortedMembers = useMemo(() => {
    const list = [...filteredMembers];
    list.sort((a, b) => {
      const valA: string | number | null = a[sortBy] ?? null;
      const valB: string | number | null = b[sortBy] ?? null;

      if (sortBy === "avgResponseTimeHours") {
        // null is away; sort away at end for asc, at start for desc
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = typeof valA === "number" ? valA : 0;
      const numB = typeof valB === "number" ? valB : 0;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredMembers, sortBy, sortOrder]);

  const filteredSnapshots = useMemo(() => {
    if (!snapshots) return [];

    return snapshots.filter((snapshot) => {
      if (snapshotStatusFilter !== "all" && snapshot.status !== snapshotStatusFilter) {
        return false;
      }
      if (reviewRequiredOnly && !snapshot.reviewRequired) {
        return false;
      }
      return true;
    });
  }, [snapshots, snapshotStatusFilter, reviewRequiredOnly]);

  return {
    report,
    snapshots,
    loading,
    error,
    successMessage,
    activeTab,
    statusFilter,
    snapshotStatusFilter,
    reviewRequiredOnly,
    searchQuery,
    sortBy,
    sortOrder,
    selectedMemberId,
    selectedSnapshotId,
    filteredMembers,
    sortedMembers,
    filteredSnapshots,
    setReport,
    setSnapshots,
    setLoading,
    setError,
    setSuccessMessage,
    setActiveTab,
    setStatusFilter,
    setSnapshotStatusFilter,
    setReviewRequiredOnly,
    setSearchQuery,
    handleSort,
    setSelectedMemberId,
    setSelectedSnapshotId,
    handleClearFilters,
    handleLoadSampleFixtures,
    handleRefresh,
    handleDismissSuccess,
  };
}
