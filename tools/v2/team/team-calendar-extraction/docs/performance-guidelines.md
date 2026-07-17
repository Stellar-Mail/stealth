# Performance Guidelines: Team Calendar Extraction

This document outlines performance constraints and optimization strategies for processing large emails, attachments, teams, or histories.

## Core Resource Limits

To prevent UI freezing, browser crashes, or memory leaks, the Team Calendar Extraction tool enforces the following default processing limits:

| Parameter                        | Limit            | Enforcement Level                            |
| -------------------------------- | ---------------- | -------------------------------------------- |
| Maximum Email Payload            | 5 MB             | Rejected before parsing                      |
| Maximum Concurrent Emails        | 100              | Chunked / paginated processing               |
| Maximum Attachment Size (`.ics`) | 2 MB             | Rejected at file upload/parsing boundary     |
| Maximum Line Length in ICS       | 1,000 characters | Excessively long lines are truncated/skipped |
| Maximum Event Count (Per Run)    | 100 events       | Truncated when limit reached                 |
| Maximum Attendees Per Event      | 50               | Rest of attendees ignored to save memory     |

## Performance Safeguards

### 1. ReDoS Mitigation

- Regular expressions used for date-time and location extraction are applied only to string segments smaller than 1000 characters.
- Patterns use linear matching structures without overlapping nested quantifiers (e.g., `(a+)+` or `(a|a)+`).

### 2. Large Datasets Processing

- **Email History Processing**: When parsing multiple emails from a team inbox history, processing is executed in batches of 10.
- **Asynchronous Parsing**: ICS parsing and text searching are executed inside chunked `requestIdleCallback` or setTimeout yields to keep the main thread responsive.
- **Garbage Collection Optimization**: Large string buffers are cleared early. Intermediate objects (like raw split lines) are processed iteratively rather than stored in large arrays.

### 3. Attachment Safety

- Extracted binary or base64 attachment contents are discarded as soon as the relevant textual payload is parsed.
- No parsing of non-textual attachments (images, PDFs) is attempted.
