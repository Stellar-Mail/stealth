# Email Translator — testing & review notes

This document explains how the Email Translator tool is tested, how to run the
tests, what they cover, and the known limitations a reviewer should be aware of.
Everything described here lives entirely under
`tools/v2/individual/email-translator/` and is isolated from the main
application's test suite.

## What is under test

The tests target the folder-local core feature logic in
`services/emailTranslationCore.ts` (`createEmailTranslationCore`). This is the
piece that makes the tool "email-aware": it splits an email body into lines,
translates only the human-authored content, and preserves quoted replies
(`> ...`), blank lines, and signatures verbatim.

The lower-level pieces it builds on are exercised indirectly:

- `services/languages.ts` — supported-language lookup (`getLanguageByCode`).
- `services/translationProvider.ts` — the `TranslationProvider` interface.
- `types/index.ts` — `TranslationRequest` / `TranslationResult` shapes.

## How to run

From the tool folder:

    cd tools/v2/individual/email-translator
    bun x vitest run          # or: npx vitest run

Vitest is configured in `vitest.config.ts` to run only this folder's tests
(`include: ["tests/**/*.test.ts"]`, `environment: "node"`), so it does not pull
in or depend on the main application's test setup.

## Test approach: a deterministic injected provider

The bundled `MockTranslationProvider` intentionally simulates network latency
(an 800ms delay per line) and "translates" by reversing the letters in each
word. That is fine for a live UI demo but makes unit assertions slow and hard to
read.

`createEmailTranslationCore(provider?)` accepts an injected provider, so the
tests pass a tiny `FakeTranslationProvider` that:

- resolves immediately (no timers, so tests are fast and deterministic), and
- echoes each line back with a visible `<targetLanguage>` tag.

This lets the tests assert exactly which lines were sent for translation and
which were preserved untouched, without depending on wall-clock timing or the
mock's word-reversal behaviour.

## Coverage

The suite (`tests/emailTranslationCore.test.ts`) covers:

- **Empty input** — empty and whitespace-only bodies resolve to `EMPTY_BODY`.
- **Unsupported target** — an unknown target language resolves to
  `UNSUPPORTED_TARGET_LANGUAGE`.
- **Unsupported source** — an unknown source language (when supplied) resolves
  to `UNSUPPORTED_SOURCE_LANGUAGE`.
- **Quote / blank preservation** — quoted lines (`^\s*>`) and blank lines are
  copied verbatim and counted in `preservedLineCount`; only content lines are
  sent to the provider and counted in `translatedLineCount`.
- **Source-language default** — the provider receives `auto` when no source is
  given, and the explicit source otherwise.
- **Detected language** — a `detectedLanguage` reported by the provider is
  surfaced on the result.
- **All-quoted body** — a body containing only quoted lines is preserved and the
  provider is never called.
- **Language catalog** — `SUPPORTED_LANGUAGE_CODES` contains the expected codes.

## Fixtures

The tests build their sample email bodies inline (small, self-descriptive
strings) rather than reading shared fixtures, keeping each case readable in
isolation. If future tests need larger sample emails, add them under this
folder's `fixtures/` directory (per the contributor rules in `README.md`) rather
than in any main-app test helper.

## Known limitations

- **Core logic only.** These tests cover the non-UI translation core. The React
  components and hooks are not exercised here; component tests would need a DOM
  environment (`jsdom`) that this folder's `vitest.config.ts` does not currently
  enable.
- **No real provider.** Translation quality is out of scope — there is no live
  translation backend, and the default provider is a deterministic mock. Wiring
  a security-reviewed external provider is a separate future issue.
- **Line-based model.** Quote detection is purely line-prefix based (`>`), which
  matches common email clients but does not parse MIME parts, HTML email, or
  inline "On <date> wrote:" headers beyond the quoted lines themselves.

## Reviewer checklist

- Tests live only under `tools/v2/individual/email-translator/` and touch no
  main-app files.
- `bun x vitest run` (or `npx vitest run`) passes from the tool folder.
- No network access or real timers are required; the suite is deterministic.
