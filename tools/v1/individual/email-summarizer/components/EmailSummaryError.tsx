import type { JSX } from "react";

export interface EmailSummaryErrorProps {
  code: string;
  message: string;
  onRetry?: () => void;
}

export function EmailSummaryError({ code, message, onRetry }: EmailSummaryErrorProps): JSX.Element {
  return (
    <section
      aria-label="Summary error"
      role="alert"
      style={{
        border: "1px solid #e74c3c",
        borderRadius: 8,
        padding: "1.5rem",
        backgroundColor: "#fdf0ef",
      }}
    >
      <p style={{ color: "#c0392b", fontWeight: 600, marginTop: 0 }}>Unable to summarize</p>
      <p style={{ color: "#555", margin: "0.5rem 0" }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry summarizing the email"
          style={{
            padding: "0.4rem 1rem",
            border: "1px solid #c0392b",
            borderRadius: 4,
            backgroundColor: "#fff",
            color: "#c0392b",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </section>
  );
}
