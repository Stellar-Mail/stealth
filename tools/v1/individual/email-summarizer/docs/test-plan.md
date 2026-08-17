# Email Summarizer Test Plan

This folder does not contain executable tool code yet, so this document is the
folder-local test plan for issue #348. Convert each scenario below into unit or
component tests when the feature implementation lands.

## Unit Scenarios

1. Summarizes a long email into a configured maximum number of sentences.
2. Preserves source subject, sender, and received timestamp in output metadata.
3. Extracts action items into a separate list when the email includes requests.
4. Returns an empty action item list when the email is informational only.
5. Rejects empty body input with a validation error.
6. Does not include facts that are absent from the source email.
7. Produces deterministic output for repeated summarization of the same fixture.
8. Truncates or flags oversized input according to the future implementation
   limit instead of silently dropping content.

## Component Scenarios

1. Shows the summary, action items, and source metadata before the user copies
   or saves anything.
2. Presents validation errors through accessible text associated with the input
   or summary region.
3. Keeps destructive mailbox actions out of the summary review surface.
4. Provides a clear "view source" path so the user can compare summary claims
   against the original email.

## Non-Goals for This Folder

- End-to-end inbox routing.
- Database persistence.
- Real mailbox archive or label actions.
- External AI-provider integration.
