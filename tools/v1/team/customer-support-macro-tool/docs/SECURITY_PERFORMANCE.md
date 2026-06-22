# Customer Support Macro Tool Security and Performance

This document records folder-local safety constraints for the isolated Customer
Support Macro Tool. It does not change the main app shell, routing, wallet,
Stellar integration, database schema, mail renderer, or shared design system.

## Threat Assumptions

- Macro titles, bodies, and tags may be typed or pasted from untrusted sources.
- Macro bodies may contain HTML-looking text, script snippets, invisible control
  characters, or misleading bidirectional formatting marks.
- Future UI surfaces may render macro previews, search results, or copied macro
  output near live customer mail.
- Large team libraries can make search and rendering expensive if every macro is
  processed on every keystroke.

## Guard Helpers

`services/security.service.ts` provides pure helpers for future UI and service
work:

- `sanitizeMacroText(value)` removes invisible control characters and escapes
  HTML-sensitive characters.
- `validateMacroSafety(input)` rejects unsafe tag counts and oversized tags
  before they reach rendering or search.
- `limitMacrosForSearch(macros, limit)` caps large macro lists before expensive
  search or preview work.

These helpers are intentionally dependency-free and folder-local.

## Input Constraints

- Tags should be limited to 12 per macro.
- Individual tags should be 40 characters or fewer.
- Macro text displayed in preview contexts should pass through
  `sanitizeMacroText`.
- Existing length validation in `macro.service.ts` remains responsible for title
  and body size limits.

## Performance Constraints

- Search and preview flows should process a bounded macro slice by default.
- The current default search cap is 250 macros.
- Future integration work can add pagination, virtualization, or server-backed
  search without changing the folder-local guard contract.

## Review Notes

Run the focused guard tests from the repository root:

```bash
npx vitest run tools/v1/team/customer-support-macro-tool/tests/security.service.test.ts
```

The tests cover hostile text sanitization, malformed tag input, and large-list
search capping.
