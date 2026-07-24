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

```ts
import { analyzeDraft } from "..";

const { result, error } = analyzeDraft({
  id: "draft-001",
  subject: "Project kickoff",
  body: "Hi Sam,\n\nPlease review the plan and let me know your feedback.\n\nBest regards,\nAlex",
});

if (result) {
  console.log(result.score.overall);
} else {
  console.error(error);
}
```

## Input

The `DraftInput` object:

| Field     | Type      | Notes                                   |
| :-------- | :-------- | :-------------------------------------- |
| `subject` | `string?` | Optional subject line.                  |
| `body`    | `string`  | Required draft body. Must be non-empty. |

## Output

`analyzeDraft()` returns an object with one of the following shapes.

### Success

```ts
{
  result: DraftImprovementResult;
}
```

The `result` contains:

- `inputId`
- `parsed`
- `sanitized`
- `issues`
- `suggestions`
- `score`
- `summary`
- `totalIssues`
- `errorCount`
- `warningCount`
- `infoCount`

### Validation Failure

```ts
{
  error: string;
}
```

Callers should check whether `result` exists before accessing the analysis output.

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
