# Security and Performance Hardening

This document outlines the safety and performance constraints implemented for the Team Analytics Dashboard.

## Threat Assumptions

Because the Team Analytics Dashboard consumes externally sourced JSON payloads containing analytics data:

1. **Denial of Service (DoS)**: A malicious actor could provide excessively large payloads (e.g., millions of records) that consume massive amounts of memory or block the event loop while processing aggregates.
2. **Prototype Pollution / NoSQL Injection**: Unstructured or malformed objects could be passed into the dashboard report generator to manipulate backend behavior if this tool is eventually wired into a database or server-side service.

## Validation and Unsafe Inputs

To mitigate the above threats, the analytics guard helpers (`guards/analytics-guards.mjs`) enforce strict structural and limit-based bounds:

- **Maximum Thresholds**:
  - `data.members` is limited to a maximum of `500` entries per dashboard report.
  - `sourceReports` is limited to a maximum of `1000` entries per snapshot batch.
- **Type Checking**:
  - Ensures arrays are strictly `Array.isArray`.
  - Rejects null, undefined, or missing expected keys before attempting any aggregation logic.
- **Malformed Input**: If any threshold is breached or an object is structurally malformed, the tool will throw a synchronous error rather than fail silently, ensuring that poisoned data does not propagate through the service layers.

## Performance Notes

### Large Teams and Histories

- Generating average response times, SLA breach aggregates, and bottleneck identification involves $O(n)$ iteration over team members.
- By capping the member array at `500`, we ensure that the execution time for synchronous iterations (like `reduce` and `filter`) remains comfortably under a single millisecond, preventing event-loop stalls.

### Large Emails and Attachments

- This tool does **not** process raw emails or attachments. It only consumes pre-aggregated metadata (e.g., `openThreads`, `slaBreaches`, `emailsHandled`).
- If a future iteration of the main mail app calculates these metrics locally, that upstream process must implement its own chunking or worker-thread offloading for parsing large text or attachments before handing the aggregated summary to this dashboard tool.
