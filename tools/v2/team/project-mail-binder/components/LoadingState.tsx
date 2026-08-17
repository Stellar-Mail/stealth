import * as React from "react";
import { A11Y } from "../types";

/**
 * LoadingState — skeleton layout with aria-busy for async loading.
 * Mirrors the visual structure of the success state so there is no layout shift.
 */
export function LoadingState() {
  return (
    <div
      aria-busy="true"
      aria-live={A11Y.liveRegion}
      id="binder-loading-state"
      className="flex flex-col gap-3 p-4"
    >
      {/* Visually hidden loading announcement for screen readers */}
      <span className="sr-only">{A11Y.loadingText}</span>

      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg p-4"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
          aria-hidden="true"
        >
          {/* Color indicator + title skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--muted)" }} />
            <div
              className="h-4 rounded"
              style={{
                backgroundColor: "var(--muted)",
                width: `${50 + i * 12}%`,
              }}
            />
          </div>

          {/* Description skeleton */}
          <div className="mt-3 flex flex-col gap-2">
            <div
              className="h-3 w-full rounded"
              style={{ backgroundColor: "var(--muted)", opacity: 0.6 }}
            />
            <div
              className="h-3 rounded"
              style={{
                backgroundColor: "var(--muted)",
                opacity: 0.4,
                width: "70%",
              }}
            />
          </div>

          {/* Mail count badge skeleton */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-5 w-16 rounded-full"
              style={{ backgroundColor: "var(--muted)", opacity: 0.3 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
