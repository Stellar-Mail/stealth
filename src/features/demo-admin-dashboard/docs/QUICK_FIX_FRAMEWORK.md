# Validation Quick-Fix Framework

This module provides safe, one-click fixes for the most common demo-data
validation issues produced by `validateCampaignDrafts`. It is part of the Demo
Admin Dashboard initiative (issue #221) and stays fully inside
`src/features/demo-admin-dashboard/`.

## Concepts

- `QuickFix` — a safe, deterministic repair with a `kind`, a button `label`,
  and an `apply(draft, issue)` function that returns a new `Draft`.
- `QuickFixRegistry` — a read-only lookup exposing `list()`, `get(kind)`, and
  `resolve(issue)`.
- `QuickFixApplication` — the result of `applyQuickFix`: whether a fix was
  applied, the resulting drafts, and the fix that ran.

## Supported fixes

- `fill-subject` — sets a placeholder subject when the subject is empty.
- `fill-body` — sets a placeholder body when the body is empty.
- `add-recipient` — adds a safe demo recipient when the list is empty.
- `replace-unsafe-recipient` — rewrites an invalid or unsafe recipient to a
  safe example.com address, keeping the local part where possible.

## Usage

- `quickFixKindForIssue(issue)` maps a `ValidationIssue` id to a fix kind.
- `createQuickFixRegistry()` builds a registry from the built-in fixes;
  `defaultQuickFixRegistry` is a ready-made instance.
- `applyQuickFix(drafts, issue, registry?)` resolves the matching fix, applies
  it to the draft named by `issue.recordId`, and returns a new drafts array.
  The input is never mutated.

## Safety

All fixes produce fake, deterministic, review-safe values. Addresses always use
example.com. No real PII, secrets, or live network calls are introduced.
