import type { JSX } from "react";

export interface GrammarCleanerEmptyProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function GrammarCleanerEmpty({
  value,
  onChange,
  onSubmit,
}: GrammarCleanerEmptyProps): JSX.Element {
  return (
    <section
      aria-label="Grammar checker input"
      role="region"
      style={{
        border: "1px dashed #ccc",
        borderRadius: 8,
        padding: "2rem",
        textAlign: "center",
        color: "#666",
      }}
    >
      <p id="gc-empty-desc" style={{ margin: "0 0 1rem" }}>
        Paste or type text below to check for grammar issues.
      </p>
      <label
        htmlFor="gc-text-input"
        style={{
          display: "block",
          marginBottom: "0.5rem",
          fontWeight: 500,
          fontSize: "0.85rem",
          textAlign: "left",
        }}
      >
        Text to check
      </label>
      <textarea
        id="gc-text-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        aria-label="Text to check for grammar issues"
        placeholder="Enter or paste your text here..."
        rows={6}
        style={{
          width: "100%",
          border: "1px solid #d0d0d0",
          borderRadius: 4,
          padding: "0.75rem",
          fontSize: "0.9rem",
          fontFamily: "inherit",
          lineHeight: 1.5,
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={value.trim().length === 0}
        aria-label="Check grammar"
        style={{
          marginTop: "0.75rem",
          padding: "0.5rem 1.25rem",
          border: "1px solid #0066cc",
          borderRadius: 4,
          backgroundColor: "#0066cc",
          color: "#fff",
          cursor: value.trim().length === 0 ? "not-allowed" : "pointer",
          opacity: value.trim().length === 0 ? 0.5 : 1,
          fontSize: "0.9rem",
        }}
      >
        Check Grammar
      </button>
    </section>
  );
}
