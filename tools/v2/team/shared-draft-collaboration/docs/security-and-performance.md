# Security & Performance Constraints - Shared Draft Collaboration

This document defines the safety boundaries, threat assumptions, input sanitization rules, and performance constraints designed for the Shared Draft Collaboration tool.

---

## 1. Threat Model & Unsafe Inputs

As a collaborative workspace, multiple team members can contribute to draft metadata (titles, subjects, collaborator counts) asynchronously. This introduces several threat vectors:

### XSS & HTML Injection (Cross-Site Scripting)

- **Vector**: A malicious actor injects standard HTML tags or `<script>` payloads into the draft's `title` or `subject` to execute scripts in the browsers of other collaborators.
- **Guard Policy**: The system passes all text fields through `sanitizeText()`, stripping out HTML tags (`/<[^>]*>/g`) before any storage or state updates.

### HTTP Header / CRLF Injection

- **Vector**: Injecting carriage returns (`\r`) or line feeds (`\n`) in draft names to hijack mail headers when draft updates translate into real email headers.
- **Guard Policy**: All carriage return, line feed, and null control characters are stripped and replaced with spaces.

### Suffix & Path Traversal Bypasses

- **Vector**: Forging draft IDs containing directory traversals (e.g. `../../secret`) to hijack internal folder contexts.
- **Guard Policy**: Draft IDs are strictly checked against `^[a-zA-Z0-9_-]+$`, blocking slashes, spaces, and dots.

---

## 2. Input Validation & Guards Specification

All validations are implemented inside the folder-local [guards/draft-guards.mjs](file:///home/henry/projects/open-source/stealth/tools/v2/team/shared-draft-collaboration/guards/draft-guards.mjs):

- **`sanitizeText(raw)`**: Strips tags and carriage returns from inputs.
- **`validateDraftId(id)`**: Max 64 characters. Restricts characters to alphanumeric and safe separators.
- **`validateDraftTitle(title)`**: Non-empty, max 120 characters.
- **`validateDraftSubject(subject)`**: Max 200 characters.
- **`validateCollaboratorCount(count)`**: Enforces count to be an integer between 1 and 50.
- **`validateSearchQuery(query)`**: Max 100 characters. Prevents ReDoS (Regular Expression Denial of Service) resource consumption.
- **`guardDraftsCount(drafts)`**: Rejects draft insertion if count reaches 1000.

---

## 3. Performance & Resource Constraints

### Large Teams & Collaborator Counts

- **Issue**: Very high numbers of concurrent users modifying a draft can slow down search rendering and list filtering.
- **Solution**: The `validateCollaboratorCount` guard sets an upper bound of `MAX_COLLABORATORS = 50`.

### Heavy History & Draft queues

- **Issue**: A large number of draft records can exhaust browser RAM.
- **Solution**: In-memory database array sizes are constrained to `MAX_DRAFTS_COUNT = 1000` via `guardDraftsCount()`.

### Search Filtering Latencies

- **Issue**: Users entering very long string queries can cause ReDoS attacks or sluggish performance.
- **Solution**: Search query string lengths are capped at 100 characters.
