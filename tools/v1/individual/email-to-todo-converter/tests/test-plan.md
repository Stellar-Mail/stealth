# Email-to-Todo Converter Test Plan

This test plan is folder-local because the tool is not integrated with the app shell yet.
It should become executable unit coverage when the first implementation lands.

## Fixture Setup

Use:

```text
tools/v1/individual/email-to-todo-converter/fixtures/email-todo-cases.json
```

Each fixture contains the normalized email input and the expected todos. Future tests
should assert the returned task text first, then validate confidence, evidence, and optional
dueDate/priority.

## Scenarios

| Scenario              | Fixture                   | Expected result                                                               |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Clear deadline        | `budget-review-deadline`  | One high-confidence todo; task mentions review and comments; dueDate present. |
| Meeting follow-up     | `team-sync-reschedule`    | One high-confidence todo; task captures confirm action; no dueDate required.  |
| Multiple actions      | `project-kickoff-actions` | Three distinct todos; respects at-most-five rule; all high confidence.        |
| No actionable content | `newsletter-june-update`  | Empty array; no forced todo created.                                          |
| Ambiguous request     | `catch-up-sometime`       | One low-confidence todo; evidence is minimal and quoted.                      |

## Negative Checks

- Empty subject and snippet should return empty array, not a fallback todo.
- Ambiguous input must stay `low` confidence; must not upgrade without clear signals.
- Re-running the same input fixture must not create duplicate todos.
- Evidence must quote only the minimal text needed; must not include full body.

## Manual Review

1. Confirm all changed files stay under `tools/v1/individual/email-to-todo-converter/`.
2. Confirm fixture examples avoid real personal data, secrets, access tokens, and live
   wallet addresses.
3. Confirm the README documents setup, usage, fixtures, and limitations.
4. Confirm future executable tests can be written from this plan without touching the
   main application.
