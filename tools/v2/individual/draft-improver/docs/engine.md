# Draft Improver - Core Engine

The core engine analyses an email draft and returns a quality score, a set of
metrics, and a list of actionable suggestions. It lives entirely inside this
tool folder and is **not** wired into the main application.

## Design

- **Pure and deterministic** - the same input always produces the same output.
- **No side effects** - no network calls, no file access, no secrets, and no
  reading of real user data.
- **Synchronous** - the `improveDraft` call returns immediately. There is no
  async "loading" state in the engine itself; a future UI can show a spinner
  while it awaits the (near-instant) call.

## Public API

Import only from the folder-local entry point, `index.ts`. Example usage:

    import { improveDraft } from "..";

    const result = improveDraft({
      subject: "Project kickoff",
      body: "Hi Sam, please review the plan.",
    });

    if (result.ok) {
      // result.analysis.score, result.analysis.metrics, result.analysis.suggestions
    } else {
      // result.error.code is "EMPTY_DRAFT" or "INVALID_INPUT"
    }

## Input

The `DraftInput` object:

| Field     | Type      | Notes                                   |
| :-------- | :-------- | :-------------------------------------- |
| `subject` | `string?` | Optional subject line.                  |
| `body`    | `string`  | Required draft body. Must be non-empty. |

## Output

The call returns a discriminated union, `DraftImproverResult`:

- On success: `ok: true` with an `analysis` object containing:
  - `score` - overall quality from 0 to 100.
  - `metrics` - a `DraftMetrics` object (word, sentence, and paragraph counts,
    average and longest sentence length, estimated reading time, filler-word
    count, hedging-phrase count, adverb count, exclamation count, all-caps
    count, and greeting / sign-off presence).
  - `suggestions` - a list of `Suggestion` items, each with a stable `id`,
    `category`, `severity`, `message`, and optional `detail`.
- On failure: `ok: false` with an `error` object whose `code` is one of:
  - `EMPTY_DRAFT` - the body was empty or whitespace only.
  - `INVALID_INPUT` - the body was missing or not a string.

Callers should branch on `result.ok` before reading `analysis` or `error`.

## Suggestion categories

`clarity`, `tone`, `length`, `structure`, `professionalism`.

## Scoring

The score starts at 100. Each suggestion subtracts a fixed penalty based on its
severity (`warning` more than `suggestion`; `info` none). The result is clamped
to the 0-100 range. Scoring is intentionally simple and transparent so it is
easy to reason about.

## Limitations

- Heuristics are rule-based and English-oriented; they do not use a language
  model and will not catch every writing issue.
- Detection relies on simple word and phrase matching, so unusual phrasing may
  be missed or over-flagged.
- The engine judges structure and style, not factual accuracy or intent.

## Local review

Deterministic sample drafts are exported as `DRAFT_FIXTURES` from `index.ts`
(a clean draft, a rambling one, a "shouty" one, and an empty-body error case).
Feed these into the engine to review the output by hand.
