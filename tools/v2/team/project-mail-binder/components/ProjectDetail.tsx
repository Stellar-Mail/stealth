import * as React from "react";
import type { BinderProject, BinderMail } from "../types";
import { A11Y } from "../types";

/**
 * ProjectDetail — detail panel for a selected project binder.
 *
 * Shows the project name as a heading and lists its bound emails.
 * Provides a back/close button accessible via Esc key.
 */
export function ProjectDetail({
  project,
  mails,
  onClose,
}: {
  project: BinderProject;
  mails: BinderMail[];
  onClose: () => void;
}) {
  // Focus the panel on mount for keyboard users
  const panelRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    panelRef.current?.focus();
  }, [project.id]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === A11Y.keys.ESCAPE) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const formatDate = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-label={A11Y.projectDetailLabel(project.name)}
      className="flex flex-col gap-4 p-4 outline-none"
      id="binder-project-detail"
    >
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to project list"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2"
          style={{
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--card)";
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px var(--ring)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
          id="binder-back-button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {project.name}
          </h2>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {project.mailCount} {project.mailCount === 1 ? "email" : "emails"} · Updated{" "}
            {formatDate(project.updatedAt)}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        {project.description}
      </p>

      {/* Mail list */}
      {mails.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
          No emails bound to this project yet.
        </p>
      ) : (
        <ul
          aria-label={A11Y.mailListLabel(project.name)}
          className="flex flex-col gap-1"
          id="binder-mail-list"
        >
          {mails.map((mail) => (
            <li
              key={mail.id}
              className="rounded-md p-3 transition-colors"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
              id={`binder-mail-${mail.id}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {mail.subject}
                </h4>
                <time
                  dateTime={mail.date}
                  className="shrink-0 text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {formatDate(mail.date)}
                </time>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {mail.sender}
              </p>
              <p
                className="mt-1.5 line-clamp-2 text-xs leading-relaxed"
                style={{ color: "var(--muted-foreground)", opacity: 0.8 }}
              >
                {mail.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
