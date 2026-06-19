import React from "react";
import { AuditLogEntry, formatAuditEntry } from "../auditLog";

interface AuditLogPanelProps {
  entries: AuditLogEntry[];
  title?: string;
}

/**
 * A simple, isolated component to display a list of audit log entries.
 * It uses the central formatter to ensure consistent output.
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  entries,
  title = "Campaign Audit Log",
}) => {
  return (
    <div style={{ border: "1px solid #ccc", padding: "16px", borderRadius: "8px" }}>
      <h3>{title}</h3>
      <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        {entries.map((entry) => (
          <li key={entry.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <span style={{ color: "#666", marginRight: "8px" }}>
              {new Date(entry.timestamp).toLocaleString()}
            </span>
            <span>{formatAuditEntry(entry)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
