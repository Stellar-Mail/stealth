# Contact Extractor Specs

## Purpose

Create a self-contained UI and review contract for extracting contact details
from email content without connecting to the production mail app.

## Release Scope

- Release tier: V1 launch-with-mail tool
- Audience: individual
- Folder ownership: `tools/v1/individual/contact-extractor/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Render a primary workflow for pasted or fixture-backed email text.
- Detect candidate names, email addresses, phone numbers, organizations, and
  short evidence snippets.
- Show empty, loading, error, and success states.
- Let reviewers select contacts for a future save/export step.
- Provide keyboard-friendly controls, explicit labels, status announcements, and
  visible focus states.
- Keep all fixtures synthetic.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Mailbox reads, live parsing jobs, or background sync
- Contact database writes, exports, or address-book mutation
- Network calls, model calls, analytics, secrets, or production data
- Shared design-system, wallet, Stellar, or database changes

## Input Contract

```ts
type ContactExtractionRequest = {
  id: string;
  sourceLabel: string;
  subject: string;
  from: string;
  body: string;
};
```

## Output Contract

```ts
type ExtractedContact = {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  organization?: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
  warnings: string[];
};
```

## UI States

| State   | Expected behavior                                                                 |
| ------- | --------------------------------------------------------------------------------- |
| Empty   | Explains that no email text has been loaded and exposes a labelled input.        |
| Loading | Disables extraction controls and announces that contact extraction is in progress. |
| Error   | Shows a clear message when text is missing or no contact-like data is present.    |
| Success | Presents a selectable, keyboard-friendly contact review list and summary counts.  |

## Accessibility Contract

- Text input uses a visible label and helper text.
- Primary actions are real buttons with accessible names.
- Contact selection uses labelled checkboxes.
- Results are announced through `aria-live="polite"`.
- Error feedback uses `role="alert"`.
- Focusable controls have visible focus styles in `styles.css`.
- Loading controls set `aria-busy` and disable duplicate submissions.

## Review Rules

- Preserve source evidence for each extracted contact.
- Prefer complete contacts over partial contacts.
- Do not save, send, or mutate mailbox/contact data from this isolated tool.
- Do not expose real personal data in fixtures or docs.
- Keep all changed files under the folder ownership boundary.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
