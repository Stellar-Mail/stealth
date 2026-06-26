# Performance Notes: Multi-Agent Assignment

## Overview

Because the Multi-Agent Assignment tool operates on a many-to-many relationship (multiple agents assigned to a single email/thread), performance degradation can occur if not handled carefully.

## Large Emails & Attachments

- **Payload Stripping**: When triggering assignment events, do not include the full email body or attachments in the assignment payload. Pass only the metadata (e.g., `thread_id`, `subject`, `preview_snippet`).
- **Lazy Loading**: If an agent needs to view the full history or attachments of a newly assigned thread, those should be fetched on-demand by the client, not eagerly pushed during the assignment event.

## Large Teams & Histories

- **Assignment Limits**: Limit the number of concurrent assignees to a hard cap (e.g., 10 agents per thread). Assigning a thread to an entire large team (e.g., 500 agents) will cause unnecessary database writes and UI re-renders for agents who will never actually process the thread.
- **Audit Log Growth**: Every assignment and unassignment creates a history event. For threads that bounce back and forth between multiple agents, this can bloat the thread history.
  - **Mitigation**: Batch assignment changes when possible, or squash rapid reassignments (e.g., within a 5-second window) into a single audit log entry.
- **WebSocket Broadcasts**: Emitting assignment updates via WebSockets must be targeted. Only broadcast the assignment change to the specific agents involved and the active viewers of the thread, rather than the entire workspace.
