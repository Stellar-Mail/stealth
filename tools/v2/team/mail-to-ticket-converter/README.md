# Mail-to-Ticket Converter

This folder is the isolated workspace for the Mail-to-Ticket Converter tool.
The current contribution adds safety and performance guardrails only; the tool
is not mounted in the main app.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/mail-to-ticket-converter/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Review Map

- `guards.mjs` normalizes untrusted email input into a safe ticket candidate.
- `index.mjs` exposes the folder-local public API.
- `fixtures/sample-mails.json` contains deterministic safe, hostile, and large-mail examples.
- `tests/guards.test.mjs` validates malformed input handling and processing-budget behavior.
- `docs/security-performance.md` documents threat assumptions, unsafe inputs, and scaling notes.
- `specs.md` records the local contributor boundary and future issue categories.

## Current Behavior

The guard helpers:

- reject malformed mail-like objects with structured errors,
- strip HTML/script content and control characters from ticket text,
- redact common secret-like values before ticket generation,
- cap subject, body, attachment, and thread work to avoid large input spikes,
- return reviewable warnings instead of calling external services.

All helpers are pure and local. They do not perform network calls, read
production data, require credentials, or persist anything.
