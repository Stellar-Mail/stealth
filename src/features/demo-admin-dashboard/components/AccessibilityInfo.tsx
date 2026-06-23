import React, { useState } from "react";

// Accessibility checklist items – modify as needed
const checklist = [
  "All interactive elements are keyboard‑focusable with visible focus ring",
  "Tables include <caption> and <th scope=\"col\"> for screen readers",
  "Buttons have descriptive aria‑labels and focus outlines",
  "Alert banners use role=\"alert\" or role=\"status\" with aria‑live attributes",
  "Color contrast meets WCAG AA standards",
];

/**
 * Renders an accessible checklist that can be expanded or collapsed.
 * The component is used only within the Demo Admin Dashboard feature folder.
 */
export function AccessibilityInfo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-labelledby="accessibility-guide-title" className="mb-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="accessibility-checklist"
        className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <span id="accessibility-guide-title">Accessibility Guide</span>
        <svg
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : "rotate-0"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {expanded && (
        <ul id="accessibility-checklist" className="mt-3 list-disc list-inside space-y-2 text-sm text-muted-foreground">
          {checklist.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
