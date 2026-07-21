# Email Translator

The Email Translator helps **Individual** users translate email body content between languages. A caller supplies the source text (for example, a draft or pasted message); the tool detects or accepts a source language, lets the user choose a target language, and produces translated output with copy-to-clipboard support. It is designed as an isolated V2 later-release mini-product and does not read from or write to the main mail inbox.

## Current Status

**Architecture only — implementation deferred.** This folder contains the architectural contract, module placeholders, and contributor rules. No TypeScript components, services, or hooks are implemented yet. Future issues should implement against `ARCHITECTURE.md` without modifying core application files.

## Folder Structure

```
email-translator/
├── ARCHITECTURE.md    # Module boundaries, data ownership, integration rules
├── README.md          # This file
├── components/        # EmailTranslatorShell, LanguageSelector, etc. (planned)
├── services/          # translationProvider, translationService, languageDetector (planned)
├── hooks/             # useTranslation, useLanguageDetect (planned)
├── tests/             # Local unit and integration tests (planned)
└── docs/              # Extended local documentation (planned)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for component, service, and hook responsibilities.

## Contributor Rules

1. **Stay inside this folder.** All code, tests, fixtures, and docs must live under `tools/v2/individual/email-translator/`.
2. **Do not wire into the main app.** No changes to shell, routing, inbox, wallet, Stellar core, database schema, or design system.
3. **Use local fixtures only.** Sample email bodies and mock translation responses belong in this tree — not in main app test helpers.
4. **Follow module boundaries.** UI in `components/`, logic in `services/`, state in `hooks/`, coverage in `tests/`, prose in `docs/`.
5. **Document integration separately.** If the tool needs inbox or compose integration, open a follow-up issue — do not implement it here.

Keep changes small and reviewable. Prefer mock translation providers until a security-reviewed external provider is approved.

## Labels

- GrantFox OSS
- Maybe Rewarded
- Official Campaign
- Tooling Ecosystem
- V2 Later Tool
- Individual Tool
