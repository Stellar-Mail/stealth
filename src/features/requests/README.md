# Request Triage Contributor Handoff

This module owns the existing unknown-sender review workflow: request cards,
sender conversion actions, approval or refund states, and reviewer-facing trust
details. Keep changes focused on the current requests surface and sender policy
flow; do not introduce a standalone tool or a new mailbox model here.

## Local File Map

- `RequestsTriageBoard.tsx` filters `Email[]` down to the `requests` folder,
  manages per-card optimistic state, exposes the failure simulation control,
  applies final folder/policy transitions, and renders the sender inspection
  dialog.
- `RequestCard.tsx` renders the reviewer card, postage amount, verified/unknown
  badges, message preview, inspect action, approve/block/refund CTAs, pending
  states, success undo window, failure state, retry, and undo affordance.
- `types.ts` defines `TriageAction`, `CardStatus`, and `RequestCardState`.
- `src/features/sender-conversion/ConvertSenderButton.tsx` is the shared CTA
  used by mail-list and reader surfaces when a request needs the guided sender
  conversion flow.
- `src/features/sender-conversion/types.ts` maps allow, verify, and block
  choices to folder placement, sender policy, labels, copy, and toast tone.
- `src/components/mail/data.ts` defines the `Email` shape consumed by request
  triage, including `folder`, `labels`, `senderPolicy`, `postageAmount`, and
  `verifiedSender`.

## Data Contracts

The board receives demo `Email[]` records and treats `email.folder ===
"requests"` as the only source for active request cards. It should not fetch
live inbox data or mutate mail directly. Final mutations are passed upward
through `onUpdateEmail(id, patch)` so the parent mailbox state remains the
single owner.

`TriageAction` is limited to `approve`, `block`, and `refund`. Each action maps
to a visible pending state, a success state with an undo window, and a final
folder transition. Approve moves the message to `inbox`, sets
`senderPolicy: "allow"`, and labels it `Trusted`. Block moves it to `spam`,
sets `senderPolicy: "block"`, and labels it `Blocked`. Refund moves it to
`spam` and labels it `Refunded` without marking the sender as trusted.

`postageAmount` is stored as stroops and formatted as XLM for display. Treat the
formatted value as review context only; actual refund or settlement behavior
must remain in the protocol/payment layer. `verifiedSender` controls whether
the reviewer sees a verified cryptographic-key hint or an unknown identity hint.

Sender conversion choices in `sender-conversion/types.ts` remain the canonical
allow/verify/block mapping. Do not duplicate those labels or destination-folder
rules in new request code unless the shared mapping is updated at the same time.

## User-Facing States

- The board header reports the pending request count and explains that unknown
  and paid senders can be approved, blocked, or refunded.
- The empty state says the reviewer is caught up and avoids implying that live
  network policy changed.
- Idle cards show sender display name, address, verified/unknown badge, postage
  paid, subject, preview, Inspect Context, Block, Refund, and Approve.
- Pending cards explain the in-flight action: approving sender and settling
  postage, blocking sender and registering a rule, or refunding postage amount.
- Success cards show the chosen result, a short finalization countdown, and
  Undo before the board applies the final folder/policy patch.
- Failure cards use retry/cancel affordances and say the Stellar transaction
  could not resolve without claiming funds moved.
- The inspection dialog exposes sender address, verification state, postage,
  quarantine status, subject/body preview, and attachment metadata.

## Safety And Privacy Boundaries

All request records in the current app are synthetic demo messages. Do not add
real customer mail, wallet secrets, private keys, access tokens, payment account
details, live sender addresses, or production transaction hashes to fixtures,
docs, tests, screenshots, or copy examples.

Request triage is a review UI. It must not directly perform live approval,
refund, blocklist, payment, or settlement operations. The current board simulates
network delay and emits local state patches; production integrations should keep
explicit user intent, auditable callbacks, and rollback/error handling visible.

Verified/unknown badges, refund language, postage amounts, and sender-policy
labels are trust-sensitive. Avoid copy that guarantees identity, refund
completion, payment settlement, or irreversible blocking unless the backing
service response proves it. Prefer precise wording such as `registered`,
`marked for refund`, `quarantined`, `verified cryptographic key`, and
`self-declared identity`.

The inspection dialog may show message body and attachment names, so keep it
scoped to reviewer action and avoid adding analytics, external image loads, or
clipboard/export behavior without a privacy review.

## QA Checklist

- Confirm only messages in `folder: "requests"` render as request cards.
- Verify approve, block, and refund each enter the correct pending state, success
  state, undo window, final folder transition, label cleanup, and toast tone.
- Turn on `Simulate network failure` and confirm failure, retry, and cancel stay
  local and do not mutate the message.
- Confirm `postageAmount` formats from stroops to XLM and falls back safely for
  missing or malformed values.
- Check verified and unknown sender badges, inspection-dialog verification copy,
  quarantine status, and attachment metadata on desktop-sized and narrow views.
- Verify the `ConvertSenderButton` entry point still opens the shared sender
  conversion flow when used from request-adjacent surfaces.
- Run targeted request/sender-conversion tests when available, then run
  typecheck and lint when local dependencies support the project commands.
