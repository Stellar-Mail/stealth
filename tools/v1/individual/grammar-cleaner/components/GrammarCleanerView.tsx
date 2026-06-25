import type { JSX } from "react";
import type { GrammarResult } from "../services/grammarCleaner";

export interface GrammarCleanerViewProps {
  result: GrammarResult;
  onReset: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  punctuation: "Punctuation",
  capitalization: "Capitalization",
  redundancy: "Redundancy",
};

const CATEGORY_COLORS: Record<string, string> = {
  spelling: "#e67e22",
  grammar: "#8e44ad",
  punctuation: "#2980b9",
  capitalization: "#16a085",
  redundancy: "#7f8c8d",
};

export function GrammarCleanerView({ result, onReset }: GrammarCleanerViewProps): JSX.Element {
  const { originalText, correctedText, issues, issueCount, changed } = result;

  return (
    <article
      aria-label="Grammar check results"
      style={{ border: "1px solid #e0e0e0", borderRadius: 8 }}
    >
      <header
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#f9f9fb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Grammar Check Results</h2>
        <span
          aria-live="polite"
          style={{
            fontSize: "0.8rem",
            color: issueCount > 0 ? "#c0392b" : "#27ae60",
            fontWeight: 500,
          }}
        >
          {issueCount > 0
            ? `${issueCount} issue${issueCount !== 1 ? "s" : ""} found`
            : "No issues found"}
        </span>
      </header>

      <div style={{ padding: "1.25rem" }}>
        {issueCount > 0 && (
          <section aria-label="Issues found" style={{ marginBottom: "1.25rem" }}>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                margin: "0 0 0.75rem",
                color: "#333",
              }}
            >
              Issues
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {issues.map((issue, i) => (
                <li
                  key={i}
                  style={{
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.4rem",
                    borderLeft: `3px solid ${CATEGORY_COLORS[issue.type] || "#999"}`,
                    backgroundColor: "#fafafa",
                    borderRadius: "0 4px 4px 0",
                    fontSize: "0.85rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: CATEGORY_COLORS[issue.type] || "#999",
                      textTransform: "uppercase",
                      marginBottom: "0.15rem",
                    }}
                  >
                    {CATEGORY_LABELS[issue.type] || issue.type}
                  </span>
                  <div style={{ color: "#333", lineHeight: 1.5 }}>
                    <span style={{ textDecoration: "line-through", color: "#c0392b" }}>
                      {issue.original}
                    </span>
                    {" → "}
                    <span style={{ color: "#27ae60", fontWeight: 500 }}>{issue.suggestion}</span>
                  </div>
                  <div style={{ color: "#888", fontSize: "0.78rem", marginTop: "0.15rem" }}>
                    {issue.explanation}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {changed && (
          <section aria-label="Corrected text" style={{ marginBottom: changed ? "1rem" : 0 }}>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                margin: "0 0 0.5rem",
                color: "#333",
              }}
            >
              Corrected Text
            </h3>
            <div
              aria-live="polite"
              style={{
                padding: "0.75rem",
                backgroundColor: "#f4fdf4",
                border: "1px solid #c8e6c9",
                borderRadius: 4,
                lineHeight: 1.6,
                color: "#222",
                fontSize: "0.9rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {correctedText}
            </div>
          </section>
        )}

        {!changed && issueCount === 0 && (
          <p style={{ color: "#666", fontStyle: "italic", textAlign: "center" }}>
            No grammar issues detected in the submitted text.
          </p>
        )}

        <section aria-label="Original text" style={{ marginBottom: "1rem" }}>
          <h3
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              margin: "0 0 0.5rem",
              color: "#333",
            }}
          >
            Original Text
          </h3>
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#f9f9fb",
              border: "1px solid #e0e0e0",
              borderRadius: 4,
              lineHeight: 1.6,
              color: "#444",
              fontSize: "0.9rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {originalText}
          </div>
        </section>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onReset}
            aria-label="Check another text"
            style={{
              padding: "0.4rem 1rem",
              border: "1px solid #0066cc",
              borderRadius: 4,
              backgroundColor: "#fff",
              color: "#0066cc",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Check Another
          </button>
        </div>
      </div>
    </article>
  );
}
