import type { JSX } from "react";
import type { CollisionEvent } from "../services/collisionDetection";

export interface CollisionDetectedViewProps {
  events: CollisionEvent[];
  monitoredThreads: number;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function severityColor(severity: "warning" | "critical"): string {
  return severity === "critical" ? "#e74c3c" : "#e67e22";
}

function severityBg(severity: "warning" | "critical"): string {
  return severity === "critical" ? "#fdf0ef" : "#fef9e7";
}

export function CollisionDetectedView({
  events,
  monitoredThreads,
}: CollisionDetectedViewProps): JSX.Element {
  return (
    <article
      aria-label="Collision scan results"
      style={{ border: "1px solid #e0e0e0", borderRadius: 8 }}
    >
      <header
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#f9f9fb",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Collision Detection</h2>
        <p style={{ fontSize: "0.8rem", color: "#666", margin: "0.25rem 0 0 0" }}>
          {events.length === 0
            ? "No collisions detected"
            : `${events.length} collision${
                events.length !== 1 ? "s" : ""
              } found across ${monitoredThreads} monitored thread${
                monitoredThreads !== 1 ? "s" : ""
              }`}
        </p>
      </header>

      <div style={{ padding: "1.25rem" }}>
        {events.length === 0 ? (
          <p style={{ color: "#27ae60", fontWeight: 500, margin: 0 }}>
            All clear — no duplicate replies in progress.
          </p>
        ) : (
          <ul
            role="list"
            aria-label="Collision events"
            style={{ margin: 0, padding: 0, listStyle: "none" }}
          >
            {events.map((event) => (
              <li
                key={event.id}
                tabIndex={0}
                aria-label={`Collision on ${event.threadSubject} — ${event.severity}`}
                style={{
                  border: `1px solid ${severityColor(event.severity)}`,
                  borderRadius: 6,
                  padding: "0.75rem 1rem",
                  marginBottom: "0.75rem",
                  backgroundColor: severityBg(event.severity),
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: severityColor(event.severity),
                      flexShrink: 0,
                    }}
                  />
                  <strong style={{ fontSize: "0.9rem", color: "#333" }}>
                    {event.threadSubject}
                  </strong>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: severityColor(event.severity),
                      marginLeft: "auto",
                    }}
                  >
                    {event.severity}
                  </span>
                </div>
                <ul
                  style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#555" }}
                >
                  {event.replies.map((reply) => (
                    <li key={reply.userId} style={{ marginBottom: "0.25rem" }}>
                      {reply.userName} started replying at {formatTimestamp(reply.startedAt)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
