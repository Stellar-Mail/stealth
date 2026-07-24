# Email Translator

The Email Translator helps **Individual** users translate email body content between languages. A caller supplies the source text (for example, a draft or pasted message); the tool detects or accepts a source language, lets the user choose a target language, and produces translated output with copy-to-clipboard support. It is designed as an isolated V2 later-release mini-product and does not read from or write to the main mail inbox.

## Current Status

**UI Implementation Complete.** The Email Translator tool now includes:

- ✅ Complete UI components with accessibility built-in
- ✅ Translation services with mock provider
- ✅ React hooks for state management
- ✅ Language detection capabilities
- ✅ Empty, loading, error, and success states
- ✅ Keyboard navigation and screen reader support
- ✅ Test coverage for services and components
- ✅ Documentation for accessibility and visual style

**Not yet integrated:** This tool is isolated and not wired into the main application. Future issues should handle integration following `ARCHITECTURE.md`.

## Folder Structure

```
email-translator/
├── ARCHITECTURE.md                      # Module boundaries, data ownership, integration rules
├── README.md                            # This file
├── index.ts                             # Public exports
├── components/                          # UI components
│   ├── EmailTranslatorTool.tsx          # Main tool container
│   ├── EmailTranslatorEmptyState.tsx    # Empty state display
│   ├── EmailTranslatorLoadingState.tsx  # Loading state display
│   ├── EmailTranslatorErrorState.tsx    # Error state display
│   ├── LanguageSelector.tsx             # Language picker with keyboard nav
│   ├── TranslationInput.tsx             # Source text input
│   ├── TranslationOutput.tsx            # Translated text output with copy
│   └── index.ts                         # Component exports
├── services/                            # Business logic
│   ├── languages.ts                     # Language definitions and utilities
│   ├── translationProvider.ts           # Provider interface and mock implementation
│   ├── translationService.ts            # Translation orchestration
│   └── index.ts                         # Service exports
├── hooks/                               # React hooks
│   ├── useTranslation.ts                # Translation state management
│   ├── useLanguageDetect.ts             # Auto language detection
│   └── index.ts                         # Hook exports
├── types/                               # TypeScript types
│   └── index.ts                         # Type definitions
├── tests/                               # Unit and component tests
│   ├── translationService.test.ts       # Service tests
│   ├── languages.test.ts                # Language utility tests
│   └── components.test.tsx              # Component tests
├── fixtures/                            # Test data
│   ├── sample-emails.ts                 # Sample email content
│   └── index.ts                         # Fixture exports
└── docs/                                # Documentation
    ├── ACCESSIBILITY.md                 # Accessibility implementation details
    └── VISUAL_STYLE.md                  # Visual design documentation
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
