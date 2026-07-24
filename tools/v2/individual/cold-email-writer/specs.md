# Cold Email Writer Specs

## Purpose

Generate a concise outbound cold email from typed prospect, sender, offer, and
call-to-action data.

## Execution requirements

- Export a guarded, non-throwing backend service entry point.
- Keep the core writer pure, synchronous, and deterministic.
- Return machine-readable error codes for invalid or unsafe payloads.
- Keep fixtures, tests, types, services, and documentation folder-local.
- Do not import or modify presentation, styling, routing, or application code.
