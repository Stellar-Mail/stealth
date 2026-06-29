# Security and Performance Constraints

This document outlines the strict safety boundaries and performance limits for the Meeting Assignment Tool to guarantee safe integration with the main platform.

## Threat Assumptions

The meeting assignment tool processes user-generated meeting details and assignee lists. We assume the following threat vectors:

1. **XSS / HTML Injection**: Hostile meeting titles or descriptions could contain malicious scripts.
2. **Denial of Service (DoS)**: Exceptionally large assignee lists or oversized payloads could exhaust memory and CPU when processing loops over them.
3. **Impersonation/Spoofing**: Assignee emails must be strictly validated to prevent assigning meetings to unverified external domains when unintended.
4. **Deeply Nested Payloads**: Over-nested metadata could crash parsers.

## Unsafe Inputs

Input is considered unsafe and must be rejected or sanitized if:

- **Title Length**: Exceeds 200 characters.
- **Description Length**: Exceeds 2000 characters.
- **HTML Content**: Any raw HTML tags `<...>` found in strings not explicitly intended for rich text (and even then, strict sanitization must apply).
- **Assignees**: The assignee list exceeds the safe batch size.
- **Malformed Objects**: Missing required fields like `meetingId`, `title`, or `assignees`.

## Performance Constraints

To prevent degrading the main application's performance:

1. **Assignee Limits**: A single meeting assignment payload is restricted to a maximum of 50 assignees.
2. **Batch Processing**: Any background job processing histories or sending notifications must chunk arrays into smaller batches (e.g., 20 items per tick) to yield the event loop.
3. **Data Pagination**: Viewing historical meeting assignments must be paginated (e.g., limit 50 records per page).
4. **Memory Guard**: Reject payloads larger than standard operational size limits early before any structural parsing if possible.
