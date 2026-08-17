# Security and Performance Hardening: Deal/Lead Mail Tracker

This document outlines the threat models, constraints, and performance considerations for the Deal/Lead Mail Tracker tool before it is integrated into the main app architecture.

## Threat Assumptions & Unsafe Inputs

Since this tool processes email metadata to track deals and leads, we must assume the following inputs are potentially unsafe:

- **Email Body Content:** May contain XSS vectors (e.g., `<script>`, `javascript:` URIs) if directly rendered.
- **Sender/Recipient Addresses:** May be spoofed or exceed standard lengths (buffer overflow risk).
- **Subject Lines:** May contain malicious payloads or excessive characters.
- **Attachment Metadata:** Filenames could include directory traversal attempts (`../../../etc/passwd`) or executable extensions.

### Mitigation Strategies

- All string inputs (subject, sender, body snippets) must be sanitized before being evaluated or rendered.
- Strictly type-check incoming payloads to ensure they match expected structures.

## Performance Constraints

To avoid unnecessary work on large datasets, the following limitations must be strictly enforced:

- **Large Emails:** The tracker should only parse the first `2048` characters of an email body to determine Deal/Lead intent. Processing full threads can block the event loop.
- **Attachments:** Do not parse or store attachment contents. Only evaluate attachment MIME types or file names for lead scoring.
- **Histories & Large Teams:** Pagination is mandatory. Tracker state should limit the display to the 50 most recent interactions per page. Aggregation queries (e.g., "Total Deals Closed") must be indexed when integrated with the production database.
- **DOM Rendering:** Use virtualization if rendering more than 100 items in a local UI test fixture to prevent memory exhaustion.
