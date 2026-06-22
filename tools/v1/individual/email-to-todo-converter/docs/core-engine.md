# Email-to-Todo Converter Core Engine

The core engine is a folder-local, deterministic service for turning one
normalized email into a reviewable task draft. It does not import from the main
application and does not make network calls.

## API surface

- `services/emailToTodoCore.ts` exports `convertEmailToTodos(email)`.
- `services/index.ts` re-exports the service and types.
- `index.ts` is the folder-local public entry point for future tool work.
- `fixtures/emailToTodoFixtures.ts` exports deterministic sample emails.

## Input

`EmailToTodoInput` requires:

- `id`: stable email identifier used to derive deterministic task ids.
- `subject`: normalized subject text.
- `sender`: source sender.
- `receivedAt`: ISO-8601 timestamp.
- `bodyText`: plain text body.
- `labels`: optional local labels.

Blank subject and body are rejected together so the service does not create an
empty task draft.

## Output

`convertEmailToTodos` returns an `EmailToTodoResult`:

- `success`: one task draft was created and is ready for user review.
- `empty`: the email was valid, but no clear action item was detected.
- `error`: required input was missing or invalid.

Task drafts include deterministic `id`, `title`, `notes`, `dueDate`,
`priority`, `completed`, and `source` fields. The `completed` field is always
`false` because this service only prepares drafts.

## Loading state

The service itself is synchronous and deterministic, so it does not expose a
runtime loading flag. A future UI can enter a loading state before invoking the
service and leave that state when a `success`, `empty`, or `error` result is
returned. No background sync or mailbox mutation happens here.

## Error state

Validation errors are returned as readable strings in `errors`. The current
checks cover missing email id, missing sender, invalid `receivedAt`, and blank
subject/body content.

## Deterministic extraction

The extractor scores subject and body sentences for direct request language and
known action verbs. It recognizes simple due date phrases such as `today`,
`tomorrow`, `by Friday`, and `due 2026-07-01`. High priority is assigned when
urgent language such as `urgent`, `asap`, `critical`, or `blocking` appears.
