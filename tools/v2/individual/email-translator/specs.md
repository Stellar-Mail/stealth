# Email Translator Specs

## Purpose

Translate email body content between supported languages for individual users without reading from or writing to the main mail application.

## Contributor Boundary

All work for this tool must stay in:

```text
tools/v2/individual/email-translator/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or shared design system unless a future integration issue explicitly allows it.

## Release Context

- Release tier: V2 Later
- Audience: Individual
- Current status: Architecture and local review assets only

## Expected Local Modules

- `components/`: planned UI shell, language selectors, source input, translated output, and copy feedback.
- `services/`: planned provider abstraction, translation orchestration, language detection, validation, and normalized error handling.
- `hooks/`: planned React state bridge between components and services.
- `fixtures/`: synthetic email bodies and expected review metadata.
- `tests/`: folder-local unit, integration, and fixture contract tests.
- `docs/`: setup, test plan, review notes, limitations, and future integration notes.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Review Contract

The tool should remain self-contained until a later integration issue mounts it in the mail experience. Tests and documentation should be reviewable without app-wide fixtures, live providers, real email content, or production secrets.
