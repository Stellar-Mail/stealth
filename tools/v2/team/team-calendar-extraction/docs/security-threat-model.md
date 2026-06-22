# Security Threat Model: Team Calendar Extraction

This document outlines the threat assumptions, unsafe inputs, and risk mitigations for the Team Calendar Extraction tool.

## Threat Landscape & Assumptions

The Team Calendar Extraction tool is designed to parse potentially untrusted data from email headers, email bodies (HTML/plain text), and attachments (specifically `.ics` iCalendar files). The primary threat vectors are:

1. **Hostile Inputs / Injection (XSS & HTML Injection)**
   - **Threat**: Attackers sending calendar invites with malicious `<script>` tags, iframe embeds, or HTML event handlers (e.g., `onerror`, `onload`) embedded inside description fields, locations, summaries, or attendee names.
   - **Mitigation**: Strict HTML sanitization on all extracted text fields before rendering. Event descriptions are parsed and stripped of executable scripts, unsafe styling, and invalid URL protocols (e.g., `javascript:`, `data:`).

2. **Denial of Service (DoS) / Resource Exhaustion via `.ics` Parsing**
   - **Threat**: iCalendar files with massive sizes (e.g., 50MB), single-line content without line folding, excessive number of properties, or an infinite loop/crash caused by circular recurrence rules (`RRULE`).
   - **Mitigation**:
     - Restrict file size (max 2MB for `.ics` parsing).
     - Guard property length (max 1000 characters per line/property value).
     - Enforce limits on the number of events parsed (max 100 events per file).
     - Cap maximum attendees list size to prevent excessive DOM nesting or memory use.

3. **Regular Expression Denial of Service (ReDoS)**
   - **Threat**: Maliciously crafted email content or `.ics` headers designed to trigger catastrophic backtracking in date extraction or field-matching regular expressions.
   - **Mitigation**: Length-limited string checks. Simple, non-nested regex patterns. Avoiding wildcard/greedy matches within repeating groups.

4. **Path Traversal / File Inclusion via Attachments**
   - **Threat**: Malicious attachment filenames in email data containing traversal characters (e.g. `../../etc/passwd` or null bytes) designed to exploit file systems if saved or exported.
   - **Mitigation**: Filename sanitization that strips directories, null characters, and enforces strict alphanumeric plus dot/dash/underscore filters.

## Input Security Classifications

| Input Source           | Risk Level | Primary Risk Vector                         | Safe Handling Constraint                                               |
| ---------------------- | ---------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `.ics` File Upload     | **HIGH**   | Parser crash, memory exhaustion, injection  | Max size: 2MB, max events: 100, strict property parsing limits         |
| Email Body (HTML)      | **HIGH**   | XSS, script injection, phishing UI spoofing | Strip all script, iframe, and style tags; strip dangerous href schemes |
| Email Sender/Recipient | **MEDIUM** | Spoofing, malformed email headers           | Format checking, strict email regex, max length (254 chars)            |
| Location / Summary     | **MEDIUM** | HTML Injection, control chars injection     | Escape characters, remove control characters, length constraints       |
