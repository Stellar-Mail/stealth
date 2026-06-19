# Schedule Send

Prepare future email delivery requests in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/schedule-send/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Let a user review a message and delivery time before a future integration queues
or sends the email.

## Functional Contract

- Input: draft message metadata, recipient list, local scheduled date/time,
  timezone, optional recurrence, and optional cancellation/edit state.
- Output: normalized schedule review model.
- The review model should include:
  - `draftId`
  - `recipients`
  - `subject`
  - `scheduledLocalTime`
  - `timezone`
  - `scheduledUtc`
  - `status`
  - `warnings`
  - optional `recurrence`
- Past times must be rejected or flagged before confirmation.
- Ambiguous daylight-saving times must be flagged for manual review.
- Sending or queue mutation must require explicit confirmation.

## Schedule Status Language

- `draft`: not ready for scheduling.
- `ready-for-confirmation`: valid schedule awaiting explicit user action.
- `scheduled`: reserved for future integration after confirmed queue creation.
- `cancelled`: schedule was removed before delivery.
- `failed`: scheduling attempt failed and did not queue delivery.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Timezone must be visible near the selected time.
- Recipient counts and individual recipients must be reviewable before confirm.
- Confirm, edit, and cancel actions must be keyboard accessible.
- Warning states must use text labels, not color alone.

## Security And Performance Expectations

- No automatic send, queue creation, or background delivery from this folder.
- No credentials, tokens, or personal payment details in fixtures.
- Date parsing must be deterministic and bounded.
- Confirmation copy must make the delivery time and timezone explicit.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
