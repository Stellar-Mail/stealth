# Email Summarizer Engine

Core feature engine for the Email Summarizer tool. Pure, deterministic, and
fully isolated inside this folder.

## Public API

Imported from the folder-local entry point (index.ts):

- summarizeEmail(input, options?) - main entry point.
- extractActionItems(body) - pull action items from an email body.
- splitSentences(text) - deterministic sentence splitter.
- toReadyState(result) - map a result into a UI-friendly state.
- DEFAULT_SUMMARIZER_OPTIONS - default sentence/character limits.
- SAMPLE_EMAILS, EMPTY_BODY_EMAIL - deterministic fixtures.

## Inputs

NormalizedEmail:

- subject - string
- sender - string
- receivedAt - ISO timestamp string
- body - plain-text email body

SummarizerOptions (optional):

- maxSentences - narrative sentence cap (default 3)
- maxCharacters - narrative character cap (default 280)

## Outputs

On success, summarizeEmail returns { status: "ok", summary } where summary has:

- summary - concise narrative within the configured limits
- actionItems - action items extracted separately from the narrative
- sentenceCount - number of sentences kept in the summary
- truncated - whether the summary was shortened
- source - preserved subject, sender, and receivedAt for traceability

## Loading states

The engine is synchronous and pure. For async UI usage, SummarizerState models
the lifecycle a component can render:

- idle - nothing requested yet
- loading - a summarize call is in flight
- ready - summary available
- error - summarize failed

toReadyState converts a SummarizerResult into ready/error for the UI.

## Error states

summarizeEmail never throws. It returns { status: "error", code, message }:

- empty-body - the email body is empty or whitespace only
- unsupported-input - the input is not a valid normalized email

## Guarantees

- No live network calls, secrets, or production data.
- No mailbox mutation and no persistence outside this folder.
- Deterministic: the same input always produces the same output.
- The summary is extracted from the email body and does not invent facts.
