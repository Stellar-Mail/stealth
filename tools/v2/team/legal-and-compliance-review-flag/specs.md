# Legal and Compliance Review Flag

The Legal and Compliance Review Flag is a V2 team tool that identifies mail or
workflow items needing legal, compliance, finance, or ownership review before
the team responds.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/legal-and-compliance-review-flag/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Core Inputs

- `items`: an array of mail or workflow review items.
- `isLoading`: optional boolean used by future UI callers to request a loading
  report.
- Each item should include `id`, `subject` or `title`, and optional context such
  as `body`, `requestedAction`, `attachments`, `containsExternalData`,
  `contractValue`, `reviewer`, `legalOwner`, or `complianceOwner`.

## Core Outputs

- `state`: `loading`, `empty`, `success`, or `error`.
- `status`: `pending`, `ready`, `clear`, `review_required`, or `blocked`.
- `items`: per-item evaluations with `flags`, `severity`, `status`, and
  `recommendedReviewer`.
- `summary`: counts by severity and overall highest severity.
- `errors`: validation messages for invalid input.

## Flag Categories

- Legal review: contract, NDA, MSA, DPA, terms, addendum, liability, or
  procurement language.
- Compliance risk: PII, personal data, privacy regulation, customer export, or
  regulated data language.
- Sanctions and export control: sanctions, embargo, restricted country,
  dual-use, or export-control language.
- Finance review: invoice, refund, chargeback, tax, or payment language.
- Approval gap: high-value or external-data items without an owner or reviewer.

## Non-Goals

- No main application routing, navigation, mail rendering, wallet, Stellar,
  database, or design-system changes.
- No production data, live network calls, secrets, or third-party service calls.
- No final legal judgment. The engine only flags review needs for humans.
