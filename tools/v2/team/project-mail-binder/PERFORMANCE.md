# Performance Notes: Project Mail Binder

## Overview

The Project Mail Binder creates and queries many-to-many relationships between email threads and project records. Without careful scoping, this can become expensive as projects accumulate mail history over time.

## Large Emails & Attachments

**Do not store mail body or attachments in the bind record.**

When a thread is bound to a project, only store:

- `thread_id` (UUID reference)
- `subject` (truncated to 200 characters maximum)
- `sender_preview` (display name only, no email address in the index)
- `bound_at` timestamp

Fetching the full thread body or attachments must happen lazily on the client when the user explicitly opens the thread from the project view. Including full content in the bind record:

- Increases row size, slowing index scans.
- Creates data duplication that diverges from the mail store over time.
- Risks embedding stale content (e.g., the mail was edited or retracted after binding).

## Large Thread Histories

Projects that accumulate hundreds of bound threads over months will see slow list queries if the binder fetches all threads eagerly.

**Mitigations:**

- Paginate bound thread lists (default page size: 20).
- Apply a hard cap on the number of threads a single project can have bound to it (suggested: 500). Surface a warning when approaching this limit.
- Use cursor-based pagination rather than offset pagination to avoid re-scanning large tables on every page load.

## Large Teams (Multi-Viewer Scenarios)

When many team members view the same project simultaneously, the "bind" and "unbind" events can create write contention on the relationship table.

**Mitigations:**

- Debounce rapid bind/unbind operations from the same user (e.g., within a 2-second window) to avoid creating duplicate relationship records.
- Use optimistic locking or a `version` column on the project bind list to prevent race conditions when two agents bind different threads at the same millisecond.

## Query Performance

- Index the `(project_id, bound_at DESC)` pair to support efficient "most recently bound threads" queries without a full table scan.
- Index `(thread_id)` separately to support "which projects is this thread bound to?" lookups.
- Avoid `SELECT *` on the bind table — only select the columns needed for the current view (list vs. detail view have different column requirements).
