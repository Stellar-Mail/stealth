import type { JSX } from "react";
import type { EmailSummary } from "../services/emailSummarizer";

export interface EmailSummaryViewProps {
  summary: EmailSummary;
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

export function EmailSummaryView({ summary }: EmailSummaryViewProps): JSX.Element {
  const { summary: narrative, actionItems, source, sentenceCount, truncated } = summary;

  return (
    <article aria-label="Email summary" style={{ border: "1px solid #e0e0e0", borderRadius: 8 }}>
      <header
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#f9f9fb",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{source.subject}</h2>
        <dl
          style={{
            display: "flex",
            gap: "1.5rem",
            margin: "0.5rem 0 0",
            fontSize: "0.8rem",
            color: "#666",
          }}
        >
          <div>
            <dt style={{ display: "inline", fontWeight: 500 }}>From:</dt>
            <dd style={{ display: "inline", marginLeft: 4 }}>{source.sender}</dd>
          </div>
          <div>
            <dt style={{ display: "inline", fontWeight: 500 }}>Received:</dt>
            <dd style={{ display: "inline", marginLeft: 4 }}>
              {formatTimestamp(source.receivedAt)}
            </dd>
          </div>
        </dl>
      </header>

      <div style={{ padding: "1.25rem" }}>
        <div aria-live="polite" style={{ lineHeight: 1.6, color: "#222", marginBottom: "1rem" }}>
          {narrative}
        </div>

        {truncated && (
          <p
            aria-label="Summary truncated"
            style={{ fontSize: "0.8rem", color: "#888", fontStyle: "italic" }}
          >
            Summary limited to {sentenceCount} sentence{sentenceCount !== 1 ? "s" : ""}. View the
            original email for full context.
          </p>
        )}

        {actionItems.length > 0 && (
          <section aria-label="Action items">
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                margin: "1rem 0 0.5rem",
                color: "#333",
              }}
            >
              Action items
            </h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {actionItems.map((item, i) => (
                <li key={i} style={{ marginBottom: "0.4rem", lineHeight: 1.5, color: "#444" }}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
