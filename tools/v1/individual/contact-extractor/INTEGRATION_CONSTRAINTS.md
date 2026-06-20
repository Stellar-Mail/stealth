# Contact Extractor - Integration Constraints

This document records the boundaries that keep the Contact Extractor tool isolated from the main application during V1 development.

## 1. Isolation rules

- All implementation stays inside `tools/v1/individual/contact-extractor/`.
- The tool must not modify the main application shell, dashboard layout, navigation system, authentication, wallet core, mail rendering engine, existing inbox architecture, existing routing, Stellar integration core, database schema, or the shared design system.
- The tool does not register routes, navigation entries, or global providers in this phase.

## 2. Dependency constraints

- Only folder-local imports are allowed: no file outside this folder may be imported, and the main app must not import this folder yet.
- Allowed external dependencies are limited to the existing project runtime (React and TypeScript) and presentational asset libraries already used in the repository.
- No new runtime services, network clients, or persistence layers are introduced.

## 3. Data and safety constraints

- All fixtures and samples remain fake, deterministic, and safe for public review.
- No real user data, secrets, private keys, or live network calls.

## 4. Future integration

- A connection to the main mail app (for example, reading the selected message or saving extracted contacts) is intentionally out of scope for V1.
- Any such integration must be proposed as a separate follow-up issue that explicitly links this tool so it can be reviewed on its own.
