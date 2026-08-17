import React from "react";
import type { DashboardMemberSnapshot, MemberStatus } from "../contract/analytics-contract";

export type SortColumn =
  | "memberId"
  | "name"
  | "status"
  | "emailsReceived"
  | "emailsHandled"
  | "openThreads"
  | "resolvedThreads"
  | "slaBreaches"
  | "avgResponseTimeHours";

export interface MemberTableProps {
  members: DashboardMemberSnapshot[];
  sortBy?: SortColumn;
  sortOrder?: "asc" | "desc";
  onSort?: (column: SortColumn) => void;
  selectedMemberId?: string | null;
  onSelectMember?: (memberId: string) => void;
  "aria-label"?: string;
}

function getStatusBadge(status: MemberStatus) {
  switch (status) {
    case "active":
      return (
        <span
          className="bg-green-500/15 text-green-600 dark:text-green-400 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Active"
        >
          <span aria-hidden="true">✓</span> Active
        </span>
      );
    case "overloaded":
      return (
        <span
          className="bg-destructive/15 text-destructive inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Overloaded"
        >
          <span aria-hidden="true">⚠️</span> Overloaded
        </span>
      );
    case "underutilized":
      return (
        <span
          className="bg-blue-500/15 text-blue-600 dark:text-blue-400 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Underutilized"
        >
          <span aria-hidden="true">ℹ️</span> Underutilized
        </span>
      );
    case "away":
    default:
      return (
        <span
          className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Away"
        >
          <span aria-hidden="true">⏸️</span> Away
        </span>
      );
  }
}

/**
 * Accessible Member Table component for Team Analytics Dashboard.
 *
 * Provides sortable column headers with appropriate ARIA `aria-sort` attributes,
 * keyboard-selectable rows with roving/tab focus, and explicit N/A rendering for null avgResponseTimeHours.
 */
export function MemberTable({
  members,
  sortBy = "memberId",
  sortOrder = "asc",
  onSort,
  selectedMemberId,
  onSelectMember,
  "aria-label": ariaLabel = "Team member performance metrics",
}: MemberTableProps) {
  const handleSortClick = (column: SortColumn) => {
    onSort?.(column);
  };

  const renderSortableHeader = (column: SortColumn, label: string) => {
    const isSorted = sortBy === column;
    const sortState = isSorted ? (sortOrder === "asc" ? "ascending" : "descending") : "none";

    return (
      <th scope="col" aria-sort={sortState} className="px-4 py-3 text-left">
        {onSort ? (
          <button
            type="button"
            onClick={() => handleSortClick(column)}
            aria-label={`Sort by ${label} (${
              isSorted && sortOrder === "asc" ? "descending" : "ascending"
            })`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span>{label}</span>
            <span aria-hidden="true" className="text-[10px]">
              {isSorted ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
            </span>
          </button>
        ) : (
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {label}
          </span>
        )}
      </th>
    );
  };

  return (
    <div className="border-border bg-card overflow-x-auto rounded-lg border shadow-sm">
      <table aria-label={ariaLabel} className="w-full border-collapse text-sm">
        <caption className="sr-only">Team member performance metrics breakdown</caption>
        <thead className="border-border bg-muted/50 border-b">
          <tr>
            {renderSortableHeader("name", "Member")}
            {renderSortableHeader("status", "Status")}
            {renderSortableHeader("emailsReceived", "Received")}
            {renderSortableHeader("emailsHandled", "Handled")}
            {renderSortableHeader("openThreads", "Open")}
            {renderSortableHeader("resolvedThreads", "Resolved")}
            {renderSortableHeader("slaBreaches", "SLA Breaches")}
            {renderSortableHeader("avgResponseTimeHours", "Avg Response Time")}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {members.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-muted-foreground px-4 py-8 text-center text-sm">
                No team members found for this view.
              </td>
            </tr>
          ) : (
            members.map((member) => {
              const isSelected = selectedMemberId === member.memberId;
              const displayName = member.name
                ? `${member.name} (${member.memberId})`
                : member.memberId;
              const avgResponseDisplay =
                member.status === "away" || member.avgResponseTimeHours === null
                  ? "N/A"
                  : `${member.avgResponseTimeHours}h`;

              return (
                <tr
                  key={member.memberId}
                  role={onSelectMember ? "row" : undefined}
                  tabIndex={onSelectMember ? 0 : undefined}
                  aria-selected={onSelectMember ? isSelected : undefined}
                  onClick={() => onSelectMember?.(member.memberId)}
                  onKeyDown={(e) => {
                    if (onSelectMember && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelectMember(member.memberId);
                    }
                  }}
                  className={`transition-colors ${
                    isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                  } ${onSelectMember ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" : ""}`}
                >
                  <th scope="row" className="px-4 py-3 font-medium text-left">
                    {displayName}
                  </th>
                  <td className="px-4 py-3">{getStatusBadge(member.status)}</td>
                  <td className="px-4 py-3">{member.emailsReceived}</td>
                  <td className="px-4 py-3">{member.emailsHandled}</td>
                  <td className="px-4 py-3 font-medium">{member.openThreads}</td>
                  <td className="px-4 py-3">{member.resolvedThreads}</td>
                  <td className="px-4 py-3">
                    <span
                      className={member.slaBreaches > 0 ? "text-destructive font-semibold" : ""}
                    >
                      {member.slaBreaches}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      aria-label={
                        member.avgResponseTimeHours === null
                          ? "Not applicable"
                          : `${member.avgResponseTimeHours} hours`
                      }
                    >
                      {avgResponseDisplay}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
