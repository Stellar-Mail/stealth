# Draft Improver Contract

## Inputs

`improveDraft(input)` accepts a plain object:

- `id`: optional stable draft id. Defaults to `draft-local`.
- `subject`: optional draft subject.
- `body`: draft body text. Empty bodies are blocked.
- `recipientName`: optional name used for a missing greeting.
- `senderName`: optional name used for a missing signoff.
- `tone`: `neutral`, `warm`, `formal`, or `concise`.
- `channel`: `email`, `reply`, or `follow-up`.
- `audience`: `general`, `customer`, `manager`, `peer`, or `recruiter`.

## Outputs

Each review returns:

- `status`: `ready`, `needs-review`, `blocked`, or `error`.
- `loading`: always `false` for the pure helper result.
- `error`: `null` or an error object with `code` and `message`.
- `reviewRequired`: true when the user should review before sending.
- `score`: deterministic quality score from 0 to 100.
- `input`: normalized draft fields.
- `output`: improved subject, body, tone, channel, and audience.
- `issues`: detected quality or privacy issues.
- `suggestions`: user-facing suggestions mapped from issues.
- `appliedChanges`: deterministic rewrite operations.
- `metrics`: word count, sentence count, greeting, signoff, and call-to-action
  indicators.

## Loading States

`createDraftImproverService()` exposes a folder-local service state for future UI
work:

- `idle`: no review has started.
- `loading`: a review is in progress.
- `ready`: the latest review completed.
- `error`: invalid input prevented review.

The current implementation is synchronous and deterministic, so result objects
return with `loading: false`.

## Error States

Invalid inputs return:

```json
{
  "status": "error",
  "error": {
    "code": "invalid-input",
    "message": "Draft input must be an object."
  }
}
```

Drafts that contain sensitive data are not treated as runtime errors. They return
`blocked` with a `sensitive-data` issue so future UI can explain the safety
problem without losing the draft context.

## Privacy and Network Rules

- No live network calls are made.
- No secrets, production mail, personal contacts, or payment data are required.
- Fixtures use synthetic names and local examples only.
