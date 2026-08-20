// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
  SummaryCards,
  MemberTable,
  SnapshotList,
  TeamAnalyticsDashboard,
} from "../components";
import { sampleDashboardReport, sampleAnalyticsSnapshots } from "../fixtures";

afterEach(() => {
  cleanup();
});

describe("State components", () => {
  it("should render EmptyState with title, description, and action button", () => {
    const actionMock = vi.fn();
    render(
      <EmptyState
        title="No Analytics Available"
        description="Load sample analytics data."
        actionLabel="Load Data"
        onAction={actionMock}
      />,
    );

    expect(screen.getByText("No Analytics Available")).toBeDefined();
    expect(screen.getByText("Load sample analytics data.")).toBeDefined();

    const btn = screen.getByRole("button", { name: "Load Data" });
    fireEvent.click(btn);
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it("should render LoadingState with message and busy aria attributes", () => {
    render(<LoadingState message="Fetching dashboard metrics…" />);
    const statusEl = screen.getByRole("status");
    expect(statusEl.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Fetching dashboard metrics…")).toBeDefined();
  });

  it("should render ErrorState with role=alert and retry action", () => {
    const retryMock = vi.fn();
    render(
      <ErrorState
        title="Network Error"
        message="Could not connect to analytics server."
        onRetry={retryMock}
      />,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Network Error")).toBeDefined();
    expect(screen.getByText("Could not connect to analytics server.")).toBeDefined();

    const btn = screen.getByRole("button", {
      name: "Retry loading analytics data",
    });
    fireEvent.click(btn);
    expect(retryMock).toHaveBeenCalledTimes(1);
  });

  it("should render SuccessState banner and handle dismiss", () => {
    const dismissMock = vi.fn();
    render(
      <SuccessState
        title="Success"
        message="Analytics refreshed successfully."
        onDismiss={dismissMock}
      />,
    );

    expect(screen.getByText("Success")).toBeDefined();
    expect(screen.getByText("Analytics refreshed successfully.")).toBeDefined();

    const btn = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.click(btn);
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});

describe("SummaryCards component", () => {
  it("should render team summary metrics from report", () => {
    render(<SummaryCards summary={sampleDashboardReport.summary} />);

    expect(screen.getByText("134")).toBeDefined(); // totalEmailVolume
    expect(screen.getByText("19")).toBeDefined(); // totalOpen
    expect(screen.getByText("2.7h")).toBeDefined(); // teamAvgResponseTimeHours
    expect(screen.getByText("3")).toBeDefined(); // totalSlaBreaches

    expect(screen.getByText("member-001")).toBeDefined(); // topPerformer
    expect(screen.getByText("member-002")).toBeDefined(); // bottleneckMember
  });

  it("should display N/A when team average response time is null", () => {
    render(
      <SummaryCards
        summary={{
          ...sampleDashboardReport.summary,
          teamAvgResponseTimeHours: null,
        }}
      />,
    );

    const naElement = screen.getByText("N/A");
    expect(naElement.getAttribute("aria-label")).toBe("Not applicable");
  });

  it("should trigger onFilterReviewRequired when Review Required filter button is clicked", () => {
    const filterMock = vi.fn();
    render(
      <SummaryCards summary={sampleDashboardReport.summary} onFilterReviewRequired={filterMock} />,
    );

    const btn = screen.getByRole("button", {
      name: "Filter table to review required members only",
    });
    fireEvent.click(btn);
    expect(filterMock).toHaveBeenCalledTimes(1);
  });
});

describe("MemberTable component", () => {
  it("should render member rows with status badges and SLA breach counts", () => {
    render(<MemberTable members={sampleDashboardReport.members} />);

    expect(screen.getByText(/Aisha Mensah/)).toBeDefined();
    expect(screen.getByText(/Ben Torres/)).toBeDefined();

    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("Overloaded")).toBeDefined();
    expect(screen.getByText("Underutilized")).toBeDefined();
    expect(screen.getByText("Away")).toBeDefined();
  });

  it("should display N/A for away members or null avgResponseTimeHours", () => {
    render(<MemberTable members={sampleDashboardReport.members} />);

    // member-004 is Away with null avgResponseTimeHours -> should display N/A
    const awayRow = screen.getByText(/David Yun/).closest("tr");
    expect(awayRow).toBeDefined();

    const naCellm = awayRow?.querySelector("span[aria-label='Not applicable']");
    expect(naCellm?.textContent).toBe("N/A");
  });

  it("should invoke onSort when sort headers are clicked", () => {
    const sortMock = vi.fn();
    render(
      <MemberTable
        members={sampleDashboardReport.members}
        sortBy="name"
        sortOrder="asc"
        onSort={sortMock}
      />,
    );

    const statusHeaderBtn = screen.getByRole("button", {
      name: "Sort by Status (ascending)",
    });
    fireEvent.click(statusHeaderBtn);
    expect(sortMock).toHaveBeenCalledWith("status");
  });

  it("should invoke onSelectMember on click or keyboard Enter", () => {
    const selectMock = vi.fn();
    render(<MemberTable members={sampleDashboardReport.members} onSelectMember={selectMock} />);

    const row = screen.getByText(/Aisha Mensah/).closest("tr");
    expect(row).toBeDefined();

    if (row) {
      fireEvent.click(row);
      expect(selectMock).toHaveBeenCalledWith("member-001");

      fireEvent.keyDown(row, { key: "Enter", code: "Enter" });
      expect(selectMock).toHaveBeenCalledWith("member-001");
    }
  });
});

describe("SnapshotList component", () => {
  it("should render snapshot cards with status indicators and review flags", () => {
    render(<SnapshotList snapshots={sampleAnalyticsSnapshots} />);

    expect(screen.getByText("Support")).toBeDefined();
    expect(screen.getByText("Sales")).toBeDefined();
    expect(screen.getByText("Operations")).toBeDefined();
    expect(screen.getByText("Finance")).toBeDefined();

    expect(screen.getByText("Healthy")).toBeDefined();
    expect(screen.getByText("Watch")).toBeDefined();
    expect(screen.getByText("Needs Attention")).toBeDefined();
    expect(screen.getByText("Blocked")).toBeDefined();

    const reviewBadges = screen.getAllByText(/Review Required/);
    expect(reviewBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("should render N/A for blocked snapshot averageFirstResponseHours", () => {
    render(<SnapshotList snapshots={sampleAnalyticsSnapshots} />);

    const financeCard = screen.getByText("Finance").closest("li");
    const naText = financeCard?.querySelector("dd[aria-label='Not applicable']");
    expect(naText?.textContent).toBe("N/A");
  });

  it("should select snapshot when card is clicked or keyboard activated", () => {
    const selectMock = vi.fn();
    render(<SnapshotList snapshots={sampleAnalyticsSnapshots} onSelectSnapshot={selectMock} />);

    const supportCard = screen.getByLabelText(/Snapshot for team Support/);
    fireEvent.click(supportCard);
    expect(selectMock).toHaveBeenCalledWith("snapshot-support-001");

    fireEvent.keyDown(supportCard, { key: " ", code: "Space" });
    expect(selectMock).toHaveBeenCalledWith("snapshot-support-001");
  });
});

describe("TeamAnalyticsDashboard component", () => {
  it("should render main header, period label, and view tabs", () => {
    render(
      <TeamAnalyticsDashboard
        report={sampleDashboardReport}
        snapshots={sampleAnalyticsSnapshots}
      />,
    );

    expect(screen.getByRole("heading", { name: "Team Analytics Dashboard" })).toBeDefined();
    expect(screen.getByText("Week of June 9")).toBeDefined();

    expect(screen.getByRole("tab", { name: "Member Workload" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Team Snapshots" })).toBeDefined();
  });

  it("should switch tabs between Member Workload and Team Snapshots", () => {
    const tabChangeMock = vi.fn();
    render(
      <TeamAnalyticsDashboard
        report={sampleDashboardReport}
        snapshots={sampleAnalyticsSnapshots}
        activeTab="members"
        onTabChange={tabChangeMock}
      />,
    );

    const snapshotsTab = screen.getByRole("tab", { name: "Team Snapshots" });
    fireEvent.click(snapshotsTab);
    expect(tabChangeMock).toHaveBeenCalledWith("snapshots");
  });

  it("should filter members when status filter buttons are clicked", () => {
    const statusChangeMock = vi.fn();
    render(
      <TeamAnalyticsDashboard
        report={sampleDashboardReport}
        statusFilter="all"
        onStatusFilterChange={statusChangeMock}
      />,
    );

    const overloadedBtn = screen.getByRole("button", { name: "Overloaded" });
    fireEvent.click(overloadedBtn);
    expect(statusChangeMock).toHaveBeenCalledWith("overloaded");
  });

  it("should render empty state when report is null and snapshots array is empty", () => {
    const loadMock = vi.fn();
    render(<TeamAnalyticsDashboard report={null} snapshots={[]} onLoadSampleData={loadMock} />);

    expect(screen.getByText("No team analytics loaded")).toBeDefined();
    const loadBtn = screen.getByRole("button", { name: "Load sample data" });
    fireEvent.click(loadBtn);
    expect(loadMock).toHaveBeenCalledTimes(1);
  });

  it("should render loading state when loading prop is true", () => {
    render(<TeamAnalyticsDashboard loading={true} report={sampleDashboardReport} />);

    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading team analytics dashboard…")).toBeDefined();
  });

  it("should render error state when error prop is present", () => {
    const retryMock = vi.fn();
    render(
      <TeamAnalyticsDashboard
        error="Server error while computing SLA breaches"
        onRetry={retryMock}
      />,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Server error while computing SLA breaches")).toBeDefined();

    const retryBtn = screen.getByRole("button", {
      name: "Refresh team analytics data",
    });
    fireEvent.click(retryBtn);
    expect(retryMock).toHaveBeenCalledTimes(1);
  });
});
