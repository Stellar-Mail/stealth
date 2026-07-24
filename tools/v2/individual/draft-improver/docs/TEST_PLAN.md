# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v2/individual/draft-improver/tests/draft-fixtures.test.mjs
```

Expected result:

- the sample fixture parses as JSON
- each draft has stable `draft-` prefixed ids
- all drafts use synthetic data (`containsPersonalData: false`)
- the fixture covers spelling errors, missing fields, sensitive content, and a
  clean draft
- expected issues match valid categories

## Manual Review Checklist

1. Confirm all changed files are under
   `tools/v2/individual/draft-improver/`.
2. Confirm all fixture senders and content are synthetic.
3. Inspect `DraftImproverTool.tsx` for loading, error, empty, and success
   render paths.
4. Confirm the analysis callbacks are not wired to the main app.
5. Confirm `docs/SECURITY_AND_PERFORMANCE.md` documents threat assumptions and
   performance guardrails.
6. Confirm `docs/ACCESSIBILITY.md` and `docs/VISUAL_STYLE.md` cover the UI
   requirements.

## Edge Cases Covered

- empty subject line
- extremely long body (truncation)
- sensitive content patterns (API keys, secrets)
- common spelling errors
- missing greeting and closing
- passive voice detection
- overly long sentences
- missing action item
- control characters in text
- null / malformed input

## Service Validation Test Cases

| Test Case         | Input                           | Expected Result                     |
| ----------------- | ------------------------------- | ----------------------------------- |
| Null input        | `null`                          | `{ valid: false }`                  |
| Non-object input  | `"string"`                      | `{ valid: false }`                  |
| Missing subject   | `{ id: "x", body: "..." }`      | `{ valid: false }`                  |
| Empty subject     | valid draft with `subject: ""`  | Warning about missing subject       |
| Oversized input   | 300 KB string                   | `{ valid: false }` with size error  |
| Sensitive content | Draft containing `api_key: xyz` | Error-level sensitive-content issue |
| Clean draft       | Well-formed draft               | No errors, high score               |

## Future Integration Tests

When a future issue allows app wiring, add tests for:

- real mailbox adapter input normalization
- character encoding edge cases (UTF-16, emoji)
- locale-aware spell checking
- integration with the compose UI
- analysis history persistence
- network failure handling if an external API is added
