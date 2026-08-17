import type { JSX } from "react";

export function EmailSummaryEmpty(): JSX.Element {
  return (
    <section
      aria-label="No email selected"
      role="region"
      style={{
        border: "1px dashed #ccc",
        borderRadius: 8,
        padding: "2rem",
        textAlign: "center",
        color: "#666",
      }}
    >
      <p id="email-summarizer-empty-desc">
        Paste an email or select one from your inbox to generate a summary.
      </p>
    </section>
  );
}
