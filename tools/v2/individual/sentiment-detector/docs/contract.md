# Sentiment Detector — Execution Contract

Stable backend-facing contract for running sentiment analysis independently of
any presentation layer. All types live in `types/sentimentDetector.ts` and are
re-exported from the folder root `index.ts`.

## Entry points

| Export                                                                                                         | Kind                        | Use when                                                                                |
| -------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `safeAnalyzeSentiment(input: unknown, options?: unknown): SafeSentimentResult`                                 | Guarded service entry point | Caller input is untrusted (API handlers, queue consumers). Never throws.                |
| `analyzeSentiment(input: SentimentAnalysisInput, options?: SentimentAnalysisOptions): SentimentAnalysisResult` | Pure engine                 | Input is already validated and sanitized (e.g. replaying fixtures, internal pipelines). |

Both functions are pure and deterministic: no network calls, no mailbox access,
no randomness, no clock reads, and no mutation of caller-supplied objects.
Identical input always produces an identical result.

## Input

```ts
interface SentimentAnalysisInput {
  messageId: string; // required, non-empty; echoed back in the result
  subject: string; // may be empty when body is not
  body: string; // plain text; may be empty when subject is not
  senderAddress?: string; // correlation only — never analyzed
  receivedAt?: string; // ISO 8601 when present
  language?: string; // BCP 47; only "en" / "en-*" supported
}

interface SentimentAnalysisOptions {
  includeSignals?: boolean; // default true
  maxSignals?: number; // 1–100, default 25
}
```

## Output

```ts
interface SentimentAnalysisResult {
  messageId: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  score: number; // [-1, 1]; 0 = neutral / no evidence
  confidence: "low" | "medium" | "high"; // from matched-evidence count
  signals: SentimentSignal[]; // strongest first, truncated to maxSignals
  stats: SentimentStats; // deterministic counters
}
```

The guarded entry point wraps this in a discriminated union:

```ts
type SafeSentimentResult =
  | { status: "ok"; result: SentimentAnalysisResult }
  | { status: "error"; code: SentimentErrorCode; message: string; issues: SentimentIssue[] };
```

## Error codes

| Code                   | Trigger                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-input`        | Payload is not an object, `messageId` missing or blank, `subject`/`body` not strings, `receivedAt` unparseable, or optional fields have wrong types. |
| `invalid-options`      | `includeSignals` not a boolean, or `maxSignals` outside 1–100.                                                                                       |
| `input-too-large`      | `messageId` > 256 chars, `subject` > 500 chars, `body` > 50,000 chars or > 10,000 words (limits in `GUARD_LIMITS`).                                  |
| `empty-content`        | Subject and body are both empty after sanitization.                                                                                                  |
| `unsupported-language` | `language` is set and is not `en` or an `en-*` regional tag.                                                                                         |

## Scoring model

Lexicon-based and folder-local:

- Positive and negative term weights come from `POSITIVE_TERMS` / `NEGATIVE_TERMS`.
- Subject matches are weighted 1.5× body matches.
- A negation (`not`, `never`, `isn't`, …) within 2 tokens before a term flips
  its polarity.
- An intensifier (`very`, `extremely`, …) directly before a term boosts its
  weight 1.5×.
- `score = (positiveWeight − negativeWeight) / (positiveWeight + negativeWeight)`,
  rounded to 3 decimals; 0 when nothing matches.
- Labels: `mixed` when both polarities are present and the minority is ≥ 50% of
  the majority; otherwise `positive`/`negative` outside the ±0.2 neutral band,
  else `neutral`.
- Confidence: `high` ≥ 5 matches, `medium` ≥ 2, else `low`.

## Sanitization

`safeAnalyzeSentiment` normalizes text to NFC and strips ASCII control
characters and zero-width characters (U+200B–U+200D, U+2060, U+FEFF) before
scoring, so hidden characters cannot mask lexicon terms.

## Fixtures

`services/fixtures.ts` exports:

- `successFixtures` — positive, negative, mixed, neutral, and negation cases
  with their expected labels.
- `failureFixtures` — one payload per error path with its expected error code.

Tests in `tests/` replay both sets through the public entry points.

## Boundaries

This tool is a self-contained workspace. It has no imports from the main app,
routing, inbox architecture, wallet core, Stellar core, database schema, or
design system, and exports no UI. Run its tests from the repository root with:

```sh
npx vitest run --config tools/v2/individual/sentiment-detector/vitest.config.ts
```
