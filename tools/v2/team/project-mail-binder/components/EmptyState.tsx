import * as React from "react";
import { A11Y } from "../types";

/**
 * EmptyState — displayed when no project binders exist yet.
 * Provides a clear call-to-action with full keyboard accessibility.
 */
export function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center"
      id="binder-empty-state"
    >
      {/* Decorative illustration */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{
          background: "var(--gradient-glass)",
          border: "1px solid var(--border)",
        }}
        aria-hidden="true"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="6"
            y="8"
            width="28"
            height="24"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <path
            d="M14 16h12M14 21h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.3"
          />
          <circle cx="20" cy="26" r="6" fill="var(--primary)" opacity="0.15" />
          <path
            d="M20 23v6M17 26h6"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {A11Y.emptyHeading}
        </h2>
        <p className="max-w-sm text-sm" style={{ color: "var(--muted-foreground)" }}>
          Group related emails into project binders to keep your conversations organized and easy to
          find.
        </p>
      </div>

      <button
        type="button"
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
          boxShadow: "var(--shadow-elegant)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 2px var(--ring)`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-elegant)";
        }}
        id="binder-create-first"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {A11Y.emptyCta}
      </button>
    </div>
  );
}
