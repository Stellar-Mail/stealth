# Message Detail Reader Surface Contributor Handoff

This document covers the Message Detail Reader surface, focusing on how message content, sender trust, and proof metadata are presented to users. Keep changes aligned with the Stealth Mail positioning around safety, speed, and sender control.

## Local File Map

- [`EmailView.tsx`](./EmailView.tsx) renders the primary reading pane, including message header actions, body rendering, inline composer, tags, read receipt state, and integration of feature components (OTP, Snooze, Calendar Events).
- [`RightPanel.tsx`](./RightPanel.tsx) renders the contextual sidebar on desktop, offering AI summaries, quick actions (translate, schedule, snooze), today's calendar, attachments, sender profile, and high-level provenance summary.
- [`ProvenancePanel.tsx`](./ProvenancePanel.tsx) renders the cryptographic proof summary, timeline of verification steps, and collapsible technical details mapping message hashes, sender identity, and postage status.
- [`data.ts`](./data.ts) defines the `Email` contract.
- [`composeValidation.ts`](./composeValidation.ts) provides the rules and types (`ComposeMode`, `ComposeSubmission`) for the inline reply/forward composer.
- [`provenance.ts`](./provenance.ts) provides the data structures (`ProvenanceItemDetails`, `ProvenanceTimelineItem`) powering the provenance panel and inspector.

## Data Contracts and User-Facing States

The reader surface accepts a single selected `Email` object. It does not fetch data directly.

- **Email Content:** `subject`, `body`, and `attachments` are displayed within `EmailView.tsx` with support for semantic HTML and contextual parsing (e.g. `detectOtp`).
- **Sender Trust & Context:** `senderPolicy`, `avatarColor`, and custom labels annotate the sender. `RightPanel.tsx` uses this data to summarize trust and allow sender conversion.
- **Message Provenance:** Derived from the `Email` properties, `ProvenancePanel.tsx` visualizes the verification chain mapping cryptographic elements (sender identity, relay source, hash, payload commitment, postage, receipt).
- **Postage & Receipts:** The UI displays current postage status (e.g., disputed, refunded) and read receipt states (`pending`, `sent`, `none`).

### Important UI States
- **Empty State:** When no email is selected, `EmailView` presents a clean fallback (`No conversation selected`).
- **Header Actions:** Quick replies, snooze, star, archive, and trash operations trigger upward callbacks (`EmailViewActions`).
- **Inline Composer:** Activating a reply mode swaps in an inline form (`InlineReplyComposer`) checking for recipient block policies and minimum postage readiness.
- **Proof Modal:** Users can click "Inspect provenance" to view the detailed cryptographic proof map in a modal or the right panel.

## Safety and Privacy Boundaries

- **Demo Data Only:** All `Email` rows and proofs in local development (`data.ts`) are fake demo data. Do not use real user data, secrets, private keys, or live customer mail for testing or fixtures.
- **No Direct Operations:** The reader components do not mutate data, decrypt payloads, or execute smart contract transactions directly. All intents (replies, archiving, disputes) are passed out via callbacks (`onAction`, `onInlineSubmit`, etc.).
- **Trust-Sensitive Copy:** Labels regarding identity, proof, encryption, and payment are critical. Ensure the UI clearly distinguishes between "verified" and "pending" states. Avoid over-promising security if the underlying contract hasn't resolved.
- **Copy Alignment:** Always frame features within the "Stealth Mail" context—emphasize sender-control, speed, and privacy. Ensure clear separation between technical proof details and user-friendly status summaries.

## QA Checklist

- [ ] Confirm `EmailView.tsx` gracefully handles the empty state when no email is selected.
- [ ] Verify that inline compose modes (reply, reply all, forward) properly format the quoted body and respect recipient block/readiness checks.
- [ ] Check that `RightPanel.tsx` conditionally renders AI features, attachments, and the sender profile depending on email context.
- [ ] Ensure that `ProvenancePanel.tsx` accurately displays the verification timeline and correctly handles the progressive disclosure (technical details accordion).
- [ ] Validate that trust and security badges (`EmailTrustBadges`, `BadgeCheck`) properly map to the current state.
- [ ] Run the e2e test [`tests/e2e/proof-inspector.spec.ts`](../../../tests/e2e/proof-inspector.spec.ts) to ensure proof interactions are stable.
- [ ] Ensure the component respects the current `XLM` postage inputs, handling valid/invalid states gracefully in `composeValidation`.
- [ ] Run project typecheck (`npm run tsc --noEmit` or equivalent) and lint (`npm run lint` or equivalent) before committing.
