import React from "react";
import type { DatasetSummary as SummaryType } from "../types/summary";
import { formatBytes } from "../utils/summaryHelpers";
import "./DatasetSummary.css";

interface DatasetSummaryProps {
  summary: SummaryType;
  title?: string;
}

/**
 * DatasetSummary provides a high-level overview of the current draft dataset.
 * It displays key metrics (message counts, sender counts, etc.) and lists
 * validation warnings to ensure demo data remains safe and deterministic.
 */
export const DatasetSummary: React.FC<DatasetSummaryProps> = ({
  summary,
  title = "Dataset Draft Summary",
}) => {
  const {
    messageCount,
    senderCount,
    attachmentCount,
    calendarEventCount,
    unreadCount,
    starredCount,
    warnings,
    totalSizeEstimate,
  } = summary;

  return (
    <div className="dataset-summary">
      <header className="dataset-summary__header">
        <h3>{title}</h3>
      </header>

      <div className="dataset-summary__stats">
        <StatCard label="Messages" value={messageCount} />
        <StatCard label="Senders" value={senderCount} />
        <StatCard label="Attachments" value={attachmentCount} />
        <StatCard label="Events" value={calendarEventCount} />
        <StatCard label="Unread" value={unreadCount} />
        <StatCard label="Starred" value={starredCount} />
        <StatCard label="Est. Size" value={formatBytes(totalSizeEstimate)} />
      </div>

      {warnings.length > 0 && (
        <div className="dataset-summary__warnings">
          <h4>Validation Results</h4>
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className={`dataset-summary__warning-item dataset-summary__warning-item--${warning.severity}`}
            >
              <span className="dataset-summary__warning-icon">
                {warning.severity === "error" ? "ⓧ" : warning.severity === "warning" ? "⚠" : "ℹ"}
              </span>
              <span className="dataset-summary__warning-message">{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {warnings.length === 0 && (
        <div className="dataset-summary__empty">✓ No validation issues found.</div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="dataset-summary__stat-card">
    <span className="dataset-summary__stat-value">{value}</span>
    <span className="dataset-summary__stat-label">{label}</span>
  </div>
);
