import * as React from "react";
import type { BinderProject, ProjectColor } from "../types";
import { A11Y } from "../types";

// ---------------------------------------------------------------------------
// Color mapping — maps ProjectColor to oklch-based Tailwind-compatible values
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<ProjectColor, { dot: string; bg: string }> = {
  blue: { dot: "oklch(0.65 0.15 250)", bg: "oklch(0.65 0.15 250 / 0.1)" },
  purple: { dot: "oklch(0.6 0.18 290)", bg: "oklch(0.6 0.18 290 / 0.1)" },
  green: { dot: "oklch(0.7 0.16 155)", bg: "oklch(0.7 0.16 155 / 0.1)" },
  amber: { dot: "oklch(0.75 0.15 80)", bg: "oklch(0.75 0.15 80 / 0.1)" },
  rose: { dot: "oklch(0.65 0.2 15)", bg: "oklch(0.65 0.2 15 / 0.1)" },
  cyan: { dot: "oklch(0.75 0.12 200)", bg: "oklch(0.75 0.12 200 / 0.1)" },
};

/**
 * ProjectList — keyboard-navigable list of project binder cards.
 *
 * Accessibility:
 * - `<ul>` with `aria-label` for screen readers
 * - Arrow key navigation between items
 * - Enter/Space to select
 * - `aria-current="true"` on selected item
 * - Visible focus ring on all focusable items
 */
export function ProjectList({
  projects,
  selectedProjectId,
  onSelectProject,
}: {
  projects: BinderProject[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
}) {
  const itemRefs = React.useRef<(HTMLLIElement | null)[]>([]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const { ENTER, SPACE, ARROW_UP, ARROW_DOWN } = A11Y.keys;

      switch (e.key) {
        case ENTER:
        case SPACE:
          e.preventDefault();
          onSelectProject(projects[index].id);
          break;
        case ARROW_DOWN: {
          e.preventDefault();
          const next = Math.min(index + 1, projects.length - 1);
          itemRefs.current[next]?.focus();
          break;
        }
        case ARROW_UP: {
          e.preventDefault();
          const prev = Math.max(index - 1, 0);
          itemRefs.current[prev]?.focus();
          break;
        }
      }
    },
    [projects, onSelectProject],
  );

  return (
    <ul
      aria-label={A11Y.projectListLabel}
      className="flex flex-col gap-2 p-4"
      role="listbox"
      id="binder-project-list"
    >
      {projects.map((project, index) => {
        const isSelected = project.id === selectedProjectId;
        const colors = COLOR_MAP[project.color] ?? COLOR_MAP.blue;

        return (
          <li
            key={project.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => onSelectProject(project.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="cursor-pointer rounded-lg p-4 transition-all duration-150"
            style={{
              backgroundColor: isSelected ? "var(--accent)" : "var(--card)",
              border: `1px solid ${isSelected ? colors.dot : "var(--border)"}`,
              boxShadow: isSelected ? "var(--shadow-glow)" : "none",
              outline: "none",
            }}
            onFocus={(e) => {
              if (!isSelected) {
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--ring)`;
              }
            }}
            onBlur={(e) => {
              if (!isSelected) {
                e.currentTarget.style.boxShadow = "none";
              }
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = "var(--accent)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = "var(--card)";
              }
            }}
            id={`binder-project-${project.id}`}
          >
            {/* Header row: color dot + name */}
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colors.dot }}
                aria-hidden="true"
              />
              <h3 className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {project.name}
              </h3>
            </div>

            {/* Description */}
            <p
              className="mt-1.5 line-clamp-2 text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {project.description}
            </p>

            {/* Mail count badge */}
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: colors.bg,
                  color: colors.dot,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <rect
                    x="1.5"
                    y="3"
                    width="9"
                    height="6"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M1.5 4l4.5 3 4.5-3"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>
                {project.mailCount} {project.mailCount === 1 ? "email" : "emails"}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
