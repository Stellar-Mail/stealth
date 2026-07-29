// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useTeamAnalytics } from "../hooks";
import { sampleDashboardReport, sampleAnalyticsSnapshots } from "../fixtures";

afterEach(() => {
  cleanup();
});

describe("useTeamAnalytics hook", () => {
  it("should initialize with default sample report and snapshots", () => {
    const { result } = renderHook(() => useTeamAnalytics());

    expect(result.current.report?.teamId).toBe(sampleDashboardReport.teamId);
    expect(result.current.snapshots?.length).toBe(sampleAnalyticsSnapshots.length);
    expect(result.current.activeTab).toBe("members");
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.reviewRequiredOnly).toBe(false);
  });

  it("should filter members by statusFilter", () => {
    const { result } = renderHook(() => useTeamAnalytics());

    act(() => {
      result.current.setStatusFilter("overloaded");
    });

    expect(result.current.filteredMembers.length).toBe(1);
    expect(result.current.filteredMembers[0].memberId).toBe("member-002");
  });

  it("should filter members by reviewRequiredOnly", () => {
    const { result } = renderHook(() => useTeamAnalytics());

    act(() => {
      result.current.setReviewRequiredOnly(true);
    });

    expect(result.current.filteredMembers.length).toBe(1);
    expect(result.current.filteredMembers[0].memberId).toBe("member-002");
    expect(result.current.filteredMembers[0].slaBreaches).toBe(3);
  });

  it("should filter members by searchQuery on memberId or name", () => {
    const { result } = renderHook(() => useTeamAnalytics());

    act(() => {
      result.current.setSearchQuery("aisha");
    });

    expect(result.current.filteredMembers.length).toBe(1);
    expect(result.current.filteredMembers[0].name).toBe("Aisha Mensah");

    act(() => {
      result.current.setSearchQuery("member-003");
    });
    expect(result.current.filteredMembers.length).toBe(1);
    expect(result.current.filteredMembers[0].name).toBe("Clara Osei");
  });

  it("should sort members when handleSort is called", () => {
    const { result } = renderHook(() => useTeamAnalytics());

    act(() => {
      result.current.handleSort("emailsReceived");
    });

    expect(result.current.sortBy).toBe("emailsReceived");
    expect(result.current.sortOrder).toBe("asc");
    // sorted ascending: member-004 (0), member-003 (18), member-001 (42), member-002 (74)
    expect(result.current.sortedMembers[0].memberId).toBe("member-004");
    expect(result.current.sortedMembers[3].memberId).toBe("member-002");

    act(() => {
      result.current.handleSort("emailsReceived");
    });
    expect(result.current.sortOrder).toBe("desc");
    expect(result.current.sortedMembers[0].memberId).toBe("member-002");
  });

  it("should clear filters when handleClearFilters is called", () => {
    const { result } = renderHook(() => useTeamAnalytics());

    act(() => {
      result.current.setStatusFilter("active");
      result.current.setReviewRequiredOnly(true);
      result.current.setSearchQuery("test");
    });

    act(() => {
      result.current.handleClearFilters();
    });

    expect(result.current.statusFilter).toBe("all");
    expect(result.current.reviewRequiredOnly).toBe(false);
    expect(result.current.searchQuery).toBe("");
  });

  it("should handle custom onRetry via handleRefresh", () => {
    const onRetryMock = vi.fn();
    const { result } = renderHook(() => useTeamAnalytics({ onRetry: onRetryMock }));

    act(() => {
      result.current.handleRefresh();
    });

    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });
});
