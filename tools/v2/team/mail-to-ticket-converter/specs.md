# Mail-to-Ticket Converter

Convert mail into tickets.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/mail-to-ticket-converter/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
- tests/
- docs/

## Security and Performance Guardrails

This tool accepts untrusted email content, so local helpers must treat every
sender, subject, body, attachment name, and thread item as hostile until it is
validated and normalized.

Guardrail work should:

- avoid live network calls and production mail data,
- keep all fixtures deterministic and local,
- cap expensive work before parsing attachments or long histories,
- redact likely secrets from generated ticket fields,
- return structured errors and warnings instead of throwing raw parser failures.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
