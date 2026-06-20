# Receipts API Contributor Handoff

This folder owns the existing read-receipt API surface for Stealth Mail. It is a narrow API module, not a new tool surface, and changes here should keep receipt state metadata-only, participant-scoped, and easy to validate alongside the provenance UI.

## Local Files

- `index.ts` handles `POST /api/v1/receipts/` for creating a delivery receipt after validating `messageId`, `recipient`, and `sender`.
- `$messageId.ts` handles `GET /api/v1/receipts/$messageId` for reading a receipt by message hash.
- `src/server/api/receipt-service.ts` owns duplicate prevention, not-found handling, participant authorization, and read-state mutation.
- `src/server/api/domain.ts` defines `receiptSchema`, `hash32Schema`, and `stellarAddressSchema`.
- `src/server/api/repository.ts` and `src/server/api/memory-repository.ts` provide the current repository contract and in-memory demo implementation.
- `src/components/mail/ProvenancePanel.tsx` renders receipt and provenance details in the mail UI, including copy/inspect actions and postage dispute context.

Keep future edits inside these existing paths unless an issue explicitly asks for a small shared helper or test fixture.

## Data Contract

A receipt record contains only:

- `messageId`: a 32-byte lowercase hexadecimal message hash.
- `sender`: a Stellar G-address for the sender.
- `recipient`: a Stellar G-address for the recipient.
- `deliveredAt`: an ISO timestamp set when the receipt is created.
- `readAt`: an ISO timestamp after the message is marked read, or `null` before that happens.

The contract intentionally excludes message bodies, attachments, mailbox snapshots, private keys, auth tokens, payment account numbers, payment QR codes, and live customer mail.

## User-Facing States

- Create receipt: `POST /api/v1/receipts/` returns `201` with the receipt when the request actor matches the sender.
- Duplicate receipt: creating a second receipt for the same `messageId` returns a conflict error.
- Read receipt: `GET /api/v1/receipts/$messageId` returns the receipt only when the request actor is the sender or recipient.
- Missing receipt: unknown `messageId` returns a not-found error.
- Forbidden receipt: non-participants receive a forbidden error rather than receipt metadata.
- Provenance UI: `ProvenancePanel` shows receipt status, copyable identifiers, timeline state, and inspection details without exposing raw message content.

## Safety And Privacy Notes

- `requireActorMatches(request, input.sender)` protects receipt creation so callers cannot create sender-owned receipts for another account.
- `assertReceiptParticipant(receipt, actor)` protects reads so only the sender or recipient can inspect receipt metadata.
- Receipt timestamps are metadata and should not be used as proof of message body access unless the calling feature documents that guarantee.
- Hashes, contract IDs, postage records, and receipt identifiers in the provenance UI are trust-sensitive. Avoid copy that implies live verification beyond the data available to the component.
- Clipboard and inspector actions can move metadata outside the app. Keep them bounded to receipt/provenance fields and avoid adding opaque blobs.
- Demo or fixture receipts must use fake deterministic data. Do not add real user addresses, live payment records, production logs, secrets, private keys, or live mail content.
- API error responses should preserve the standard envelope shape from `src/server/api/response.ts` and avoid leaking whether unrelated actors are involved.

## Contributor Checklist

- Keep route schemas aligned with `receiptSchema` in `src/server/api/domain.ts`.
- Add or update service tests when changing duplicate, not-found, forbidden, or read-state behavior.
- Keep repository changes compatible with both the interface in `repository.ts` and the in-memory implementation.
- Keep UI copy aligned with Stealth Mail's safety, speed, and sender-control positioning.
- Avoid creating a new V1/V2 tool folder or unrelated product surface for receipt work.
- Link docs to existing local files and tests instead of describing architecture that does not exist.

## Lightweight QA Checklist

- Create a receipt with a valid sender actor and confirm `deliveredAt` is set and `readAt` is `null`.
- Attempt duplicate creation for the same `messageId` and confirm a conflict response.
- Read a receipt as the sender and as the recipient.
- Attempt to read the same receipt as a different actor and confirm a forbidden response.
- Request an unknown receipt and confirm a not-found response.
- Check that `ProvenancePanel` still renders empty, pending, verified, copied, and inspector states without showing message bodies.
- Run the most relevant local test, typecheck, or lint command when dependencies are available.
- Search changed files for secrets, private keys, payment details, personal accounts, and live mail content before opening a PR.
