# Readability Improver — Execution Contract

Stable backend-facing contract for analyzing message readability independently
of any presentation layer. All types live in `types/readabilityImprover.ts`
and are re-exported from the folder root `index.ts`.

## Entry points

| Export                                                                                         | Kind                        | Use when                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `safeImproveReadability(input: unknown, options?: unknown): SafeReadabilityResult`             | Guarded service entry point | Caller input is untrusted (API handlers, queue consumers). Never throws.                |
| `improveReadability(input: ReadabilityInput, options?: ReadabilityOptions): ReadabilityResult` | Pure engine                 | Input is already validated and sanitized (e.g. replaying fixtures, internal pipelines). |

Both functions are pure and deterministic: no network calls, no mailbox access,
no randomness, no clock reads, and no mutation of caller-supplied objects.
Identical input always produces an identical result.

## Input

```ts
interface ReadabilityInput {
  messageId: string; // required, non-empty; echoed back in the result
  subject: string; // may be empty when body is not
  body: string; // plain text; may be empty when subject is not
  senderAddress?: string; // correlation only — never analyzed
  receivedAt?: string; // ISO 8601 when present
  language?: string; // BCP 47; only "en" / "en-*" supported
}

interface ReadabilityOptions {
  includeIssues?: boolean; // default true
  maxIssues?: number; // 1–100, default 25
}
```

## Output

```ts
interface ReadabilityResult {
  messageId: string;
  score: number; // Flesch reading ease, clamped to [0, 100]
  grade: "very-easy" | "easy" | "medium" | "hard" | "very-hard";
  issues: ReadabilityIssue[]; // order of appearance, truncated to maxIssues
  metrics: ReadabilityMetrics; // word/sentence/paragraph counts, complexity
  stats: ReadabilityStats; // issueCandidates, issueCount, truncated
}

interface ReadabilityIssue {
  type: "long-sentence" | "complex-word" | "passive-voice" | "long-paragraph" | "shouting";
  severity: "info" | "warn";
  source: "subject" | "body";
  excerpt: string; // offending text, capped at 80 chars
  suggestion: string; // actionable improvement
}
```

An empty `issues` array is a valid success outcome, not an error.

The guarded entry point wraps this in a discriminated union:

```ts
type SafeReadabilityResult =
  | { status: "ok"; result: ReadabilityResult }
  | {
      status: "error";
      code: ReadabilityErrorCode;
      message: string;
      issues: ReadabilityValidationIssue[];
    };
```

## Error codes

| Code                   | Trigger                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-input`        | Payload is not an object, `messageId` missing or blank, `subject`/`body` not strings, `receivedAt` unparseable, or optional fields have wrong types. |
| `invalid-options`      | `includeIssues` not a boolean, or `maxIssues` outside 1–100.                                                                                         |
| `input-too-large`      | `messageId` > 256 chars, `subject` > 500 chars, `body` > 50,000 chars or > 10,000 words (limits in `GUARD_LIMITS`).                                  |
| `empty-content`        | Subject and body are both empty after sanitization.                                                                                                  |
| `unsupported-language` | `language` is set and is not `en` or an `en-*` regional tag.                                                                                         |

## Analysis rules

Rule-based and folder-local; the subject and each body paragraph are scanned
sentence by sentence, in order of appearance:

| Type             | Trigger                                                                                     | Severity    |
| ---------------- | ------------------------------------------------------------------------------------------- | ----------- |
| `long-sentence`  | > 25 words (> 40 words escalates)                                                           | info / warn |
| `complex-word`   | Wordy term with a plain replacement (`PLAIN_LANGUAGE_REPLACEMENTS`, e.g. "utilize" → "use") | info        |
| `passive-voice`  | Auxiliary + past participle ("was completed")                                               | info        |
| `long-paragraph` | Body paragraph > 100 words                                                                  | info        |
| `shouting`       | Two or more ALL-CAPS words (4+ letters) in a sentence                                       | warn        |

- **Score**: Flesch reading ease
  (`206.835 − 1.015 × words/sentences − 84.6 × syllables/words`), clamped to
  [0, 100] and rounded to 1 decimal; 0 for empty text. Syllables use a
  deterministic vowel-group heuristic with a silent-e correction.
- **Grade**: ≥ 90 `very-easy`, ≥ 70 `easy`, ≥ 50 `medium`, ≥ 30 `hard`,
  else `very-hard`.
- **Truncation**: issues stop at `maxIssues`; `stats.truncated` reports it.

## Sanitization

`safeImproveReadability` normalizes text to NFC and strips ASCII control
characters and zero-width characters (U+200B–U+200D, U+2060, U+FEFF) before
analysis, so hidden characters cannot mask wordy terms.

## Fixtures

`services/fixtures.ts` exports:

- `successFixtures` — clean text (no issues), a wordy formal memo, and a
  passive/shouting sample with their expected issue types.
- `failureFixtures` — one payload per error path with its expected error code.

Tests in `tests/` replay both sets through the public entry points.

## Boundaries

This tool is a self-contained workspace. It has no imports from the main app,
routing, inbox architecture, wallet core, Stellar core, database schema, or
design system, and exports no UI (`components/` and `hooks/` are untouched).
Run its tests from the repository root with:

```sh
npx vitest run --config tools/v2/individual/readability-improver/vitest.config.ts
```
