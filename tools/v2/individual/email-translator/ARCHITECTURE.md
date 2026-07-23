# Email Translator — Architecture Contract

## Purpose

The Email Translator is a self-contained V2 later-release tool for **Individual** users. It translates **email body content** between languages. Callers pass source text in; the tool returns translated text without coupling to the main mail app, inbox, or rendering pipeline.

**Release tier:** V2 Later  
**Audience:** Individual  
**Status:** Architecture contract only — implementation deferred

---

## Ownership Boundary

All work for this tool **must remain exclusively within**:

```
tools/v2/individual/email-translator/
```

This tool is a **self-contained mini-product**. It must not be wired into the main application during this issue. Future integration is a separate follow-up issue.

---

## Module Boundaries

### Directory structure

```
email-translator/
├── ARCHITECTURE.md       # This file — architectural contract
├── README.md             # Tool overview and contributor entry point
├── components/           # Presentational and container React components
├── services/             # Translation logic, provider abstraction, detection
├── hooks/                # React hooks bridging components and services
├── tests/                # Unit, integration, and fixture-based tests
└── docs/                 # Local architecture notes, API docs, integration plans
```

### `components/`

**Responsibility:** Render the translation UI. Components receive data and callbacks from hooks; they do not call translation APIs directly.

**Planned components:**

| Component              | Responsibility                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmailTranslatorShell` | Root layout container. Composes child components, wires hooks, and exposes a minimal public props surface (e.g. `sourceText`, `onTranslated`). |
| `LanguageSelector`     | Source and target language pickers. Displays available languages and emits selection changes.                                                  |
| `TranslationInput`     | Read-only or editable display of the source email body text passed in by the caller.                                                           |
| `TranslationOutput`    | Displays translated text, loading state, and error state.                                                                                      |
| `CopyButton`           | Copies translated output to the clipboard with accessible feedback.                                                                            |

**Rules:**

- No direct imports from `src/` (main app).
- No network calls — delegate to hooks → services.
- Styling may use workspace packages already in `package.json`; do not modify the shared design system.

### `services/`

**Responsibility:** Pure and async business logic for translation and language detection. No React dependencies.

**Planned modules:**

| Module                            | Responsibility                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `translationProvider` (interface) | Contract for pluggable backends (`translate(text, from, to): Promise<string>`). Enables swapping mock, local, or external API providers without touching components.     |
| `translationService`              | Orchestrates translation requests: validates input, selects provider, normalizes errors, and returns translated text.                                                    |
| `languageDetector`                | Detects the likely source language from input text (heuristic or provider-backed). Returns a language code or `unknown`.                                                 |
| `validation`                      | Input validation, sanitization, and security guards for email bodies, language codes, provider configs, and responses. Prevents XSS, injection, and prototype pollution. |
| `performance`                     | Performance utilities: caching, deduplication, timeout enforcement, text chunking, rate limiting, and monitoring.                                                        |

**Rules:**

- Provider configuration (API keys, endpoints, default provider) lives here — not in components or hooks.
- Services are testable without a DOM or React.
- No imports from main app mail, wallet, Stellar, or auth modules.
- **All untrusted input MUST pass through `validation` module before processing.**
- **Large texts (>50KB) SHOULD use `performance` module chunking utilities.**

### `hooks/`

**Responsibility:** Encapsulate component-level state and side effects. Bridge UI events to services.

**Planned hooks:**

| Hook                | Responsibility                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useTranslation`    | Manages source/target languages, triggers translation via `translationService`, and exposes `translatedText`, `isLoading`, `error`, and `translate()`.      |
| `useLanguageDetect` | Runs `languageDetector` on source text (debounced), exposes detected language and confidence, and optionally auto-sets source language in `useTranslation`. |

**Rules:**

- Hooks call services only — never fetch or parse translation responses inline.
- Hooks do not persist to main app stores or global context.
- Export hooks for use by `components/` only.

### `tests/`

**Responsibility:** Local test coverage for services, hooks, and component behavior.

**Scope:**

- Unit tests for `translationService`, `languageDetector`, and provider implementations.
- Hook tests (e.g. React Testing Library + vitest) for `useTranslation` and `useLanguageDetect`.
- Fixture-based tests using local sample email bodies — no main app test utilities.
- Integration tests for the translate flow: input → detect → translate → output.

**Rules:**

- Fixtures stay inside this folder (e.g. `tests/fixtures/` or `fixtures/` added later).
- Do not depend on main app E2E or inbox mocks.

### `docs/`

**Responsibility:** Folder-local documentation beyond this contract.

**Current contents:**

- `SECURITY.md` — Threat model, attack surfaces, input validation guidelines, and security best practices.
- `PERFORMANCE.md` — Performance budgets, bottleneck analysis, optimization strategies, and scalability considerations.

**Expected contents (future):**

- API reference for public component props and service interfaces.
- Development setup for running local tests.
- `FUTURE_INTEGRATION.md` — step-by-step wiring guide for a follow-up issue.

**Rules:**

- Do not document or modify core app files from here.
- Architecture changes must update `ARCHITECTURE.md` in the same PR.
- Security and performance considerations MUST be kept up-to-date.

---

## Data Ownership

| Data               | Owner         | Storage                                | Notes                                                                                             |
| ------------------ | ------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Source text        | Caller (prop) | Passed into `EmailTranslatorShell`     | Tool does not fetch email from inbox. Read-only unless explicitly made editable in a later issue. |
| Language selection | Local state   | `useTranslation` / `LanguageSelector`  | Source and target language codes. Not synced to main app.                                         |
| Translated output  | Local state   | `useTranslation` → `TranslationOutput` | Ephemeral unless a future issue adds persistence.                                                 |
| Provider config    | `services/`   | Module-level or injected config        | API keys, provider id, timeouts. Never hard-coded in components.                                  |

**Flow:**

```
Caller props (sourceText)
    → EmailTranslatorShell
    → useLanguageDetect (optional auto source language)
    → useTranslation
    → translationService → translationProvider
    → TranslationOutput + CopyButton
```

All data remains **client-side** and **tool-scoped** until a future integration issue explicitly defines server or inbox persistence.

---

## Integration Constraints

### This tool MAY

- Import React and test utilities already present in the workspace `package.json`.
- Use browser APIs (`navigator.clipboard`, `Intl`, etc.) from components or services.
- Define local TypeScript types within this folder.
- Add local fixtures and vitest tests under `tests/`.
- Implement a mock `translationProvider` for offline development and CI.
- Document a future integration path in `docs/` without implementing it.

### This tool MUST NOT

- Modify the main application shell, dashboard layout, or navigation system.
- Add or change routes in `src/router.tsx`, `src/routes/`, or equivalent.
- Touch authentication, wallet core, or Stellar integration core.
- Modify the database schema or server persistence layer.
- Hook into the mail rendering engine or existing inbox architecture.
- Import from or depend on `src/features/`, `src/components/ui/` overrides, or main app global stores.
- Send email body content to unapproved third-party services without a documented security review (future implementation concern — document in `docs/` when adding real providers).

---

## Future Integration Path

When a **separate follow-up issue** wires this tool into the main mail app:

1. **Create an adapter in the main app** (e.g. `src/features/email-translator/` or a mail-compose panel slot) — not inside this folder.
2. **Pass email body text as a prop** from the mail UI into `EmailTranslatorShell`; do not let this tool read the inbox directly.
3. **Register navigation or compose actions** in the main app routing/navigation layer only in that follow-up PR.
4. **Define an integration contract** documenting props, events, and error handling between mail UI and this tool.
5. **Keep `tools/v2/individual/email-translator/` as the source of truth** for translation logic; the main app should thin-wrap, not fork, services and hooks.

Do not implement any of the above in the architecture-only issue.

---

## Contributor Guidelines: May Change vs Must Not Change

### May change (within this folder only)

- Implementation of components, services, hooks, tests, and `docs/`.
- Internal file names and subfolders under `components/`, `services/`, `hooks/`, `tests/`, `docs/`.
- Mock providers, fixtures, and test coverage.
- This `ARCHITECTURE.md` when boundaries legitimately evolve (with PR description explaining why).

### Must not change

- Any file outside `tools/v2/individual/email-translator/`.
- Main app shell, routing, inbox, wallet, Stellar core, database schema, or shared design system.
- Global navigation, mail rendering engine, or authentication flows.
- Cross-tool coupling (do not import other V2 individual tools unless an explicit shared `tools/v2/shared/` contract exists and is approved).

---

## Dependency Graph

```
components/
  └── hooks/
        └── services/
              └── translationProvider (interface + implementations)

tests/  →  all modules (no production imports from tests)

docs/   →  descriptive only (no runtime imports)
```

No circular dependencies. Components must not import services directly — use hooks.

---

## Acceptance Criteria (this issue)

- [x] Folder-local architecture plan exists (`ARCHITECTURE.md`, `README.md`).
- [x] Module boundaries defined for `components/`, `services/`, `hooks/`, `tests/`, `docs/`.
- [x] No modifications to core app files.
- [x] Integration constraints and future path documented.
- [x] Contributor may/may-not rules are explicit.
- [x] Deliverable is reviewable as a self-contained mini-product.
- [x] Security threat model and input validation documented (`docs/SECURITY.md`).
- [x] Performance constraints and optimization strategies documented (`docs/PERFORMANCE.md`).
- [x] Validation and sanitization utilities implemented (`services/validation.ts`).
- [x] Performance utilities implemented (`services/performance.ts`).
- [x] Architecture updated to reflect security and performance requirements.
