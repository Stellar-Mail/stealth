import type { JSX } from "react";

export function EmailSummaryLoading(): JSX.Element {
  return (
    <section
      aria-label="Generating summary"
      aria-busy="true"
      role="region"
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        padding: "2rem",
        textAlign: "center",
        color: "#666",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          border: "3px solid #e0e0e0",
          borderTopColor: "#0066cc",
          borderRadius: "50%",
          animation: "es-spin 0.6s linear infinite",
          margin: "0 auto 0.75rem",
        }}
      />
      <p aria-live="polite">Summarizing email…</p>
      <style>{`@keyframes es-spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
