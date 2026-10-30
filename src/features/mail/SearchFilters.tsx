import { useState } from "react";
import { X } from "lucide-react";
import type { SearchFilterQuery } from "@/lib/api";

export function SearchFilters({
  value,
  query,
  onQueryChange,
  onApply,
  onClose,
}: {
  value: SearchFilterQuery;
  query: string;
  onQueryChange: (query: string) => void;
  onApply: (value: SearchFilterQuery) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const field = "mail-search-field";
  return (
    <form
      aria-label="Search filters"
      className="max-h-[calc(100dvh-64px)] space-y-2.5 overflow-y-auto px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          draft.afterDate &&
          draft.beforeDate &&
          Date.parse(draft.afterDate) >= Date.parse(draft.beforeDate)
        ) {
          setError("Choose an end date after the start date.");
          return;
        }
        onApply({
          ...draft,
          sender: draft.sender?.trim() || undefined,
          recipient: draft.recipient?.trim() || undefined,
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Search filters</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search filters"
          className="glow-ring rounded p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="mail-search-filter-row">
        <span>From</span>
        <input
          autoFocus
          className={field}
          placeholder="Name or sender address"
          value={draft.sender ?? ""}
          onChange={(event) => setDraft({ ...draft, sender: event.target.value })}
        />
      </label>
      <label className="mail-search-filter-row">
        <span>To</span>
        <input
          className={field}
          placeholder="Recipient address"
          value={draft.recipient ?? ""}
          onChange={(event) => setDraft({ ...draft, recipient: event.target.value })}
        />
      </label>
      <label className="mail-search-filter-row">
        <span>Contains words</span>
        <input
          className={field}
          placeholder="Words or an exact phrase in quotes"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <label className="mail-search-filter-row">
        <span>Search in</span>
        <select
          className={field}
          value={draft.folder ?? ""}
          onChange={(event) => setDraft({ ...draft, folder: event.target.value || undefined })}
        >
          <option value="">All mail</option>
          {["inbox", "sent", "drafts", "archive", "pending", "requests", "spam", "trash"].map(
            (folder) => (
              <option key={folder} value={folder}>
                {folder[0].toUpperCase() + folder.slice(1)}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="mail-search-filter-row">
        <span>Read status</span>
        <select
          className={field}
          value={draft.unread === undefined ? "" : String(draft.unread)}
          onChange={(event) =>
            setDraft({
              ...draft,
              unread: event.target.value === "" ? undefined : event.target.value === "true",
            })
          }
        >
          <option value="">Any</option>
          <option value="true">Unread</option>
          <option value="false">Read</option>
        </select>
      </label>
      <label className="mail-search-filter-row">
        <span>After</span>
        <input
          type="date"
          className={field}
          value={draft.afterDate?.slice(0, 10) ?? ""}
          onChange={(event) => {
            setError("");
            setDraft({
              ...draft,
              afterDate: event.target.value ? `${event.target.value}T00:00:00Z` : undefined,
            });
          }}
        />
      </label>
      <label className="mail-search-filter-row">
        <span>Before</span>
        <input
          type="date"
          className={field}
          value={draft.beforeDate?.slice(0, 10) ?? ""}
          onChange={(event) => {
            setError("");
            setDraft({
              ...draft,
              beforeDate: event.target.value ? `${event.target.value}T00:00:00Z` : undefined,
            });
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={draft.hasAttachments === true}
            onChange={(event) =>
              setDraft({ ...draft, hasAttachments: event.target.checked || undefined })
            }
          />
          Has attachments
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={draft.starred === true}
            onChange={(event) => setDraft({ ...draft, starred: event.target.checked || undefined })}
          />
          Starred
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-primary"
            checked={draft.includeDeleted === true}
            onChange={(event) =>
              setDraft({ ...draft, includeDeleted: event.target.checked || undefined })
            }
          />
          Include trash
        </label>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          className="glow-ring rounded px-2 py-1 text-xs text-muted-foreground"
          onClick={() => {
            setDraft({});
            setError("");
          }}
        >
          Reset filters
        </button>
        <button
          type="submit"
          className="glow-ring rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background"
        >
          Search mail
        </button>
      </div>
    </form>
  );
}
