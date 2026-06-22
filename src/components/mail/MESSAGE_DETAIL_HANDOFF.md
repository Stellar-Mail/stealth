# Message Detail Reader Safety Handoff

## Scope

This handoff covers the existing message detail reading surface:

- `EmailView.tsx` - main reading pane, header actions, body rendering, inline replies, attachments, tags, read receipts, and calendar/OTP cards.
- `RightPanel.tsx` - contextual summary, quick actions, related calendar state, attachments, sender conversion, and provenance shortcut.
- `ProvenancePanel.tsx` - sender identity, relay/source metadata, message hash, payload commitment, postage, receipt, copy actions, and inspector entrypoints.
- `provenance.ts` - local provenance model derived from demo email records.
- `EmailTrustBadges.tsx` and `trust-state.ts` - sender trust and warning presentation.
- `data.ts` - demo mail records used by the current UI.

Do not create a new standalone tool folder for this area. Keep changes inside
the existing mail reader modules unless a small shared helper is clearly needed.

## Data Contracts

Contributors should understand these local contracts before changing behavior:

| Contract | Location | Notes |
| --- | --- | --- |
| `Email` | `data.ts` | Demo message shape consumed by the reader and right panel |
| `EmailViewActions` | `EmailView.tsx` | All parent-provided callbacks for reply, archive, trash, calendar, read receipt, and attachment preview |
| `ContextAction` | `RightPanel.tsx` | Right-panel quick action identifiers |
| `ProvenanceDetails` | `provenance.ts` | Derived proof, relay, postage, and receipt metadata |
| `PostageDisputeStatus` | `PostageDisputePanel.tsx` | Contract-adjacent dispute states rendered from provenance |

## User-Facing States

Review the reader in these states:

- no selected conversation
- selected message with trusted sender
- selected message with unverified or risky sender
- message with attachments
- message with OTP/card extraction
- message with calendar event extraction
- inline reply, reply-all, and forward modes
- read receipt available and sent
- provenance collapsed, expanded, copied, and inspected
- right panel summary empty, generated, and disabled when no email is selected

## Safety And Privacy Notes

- The current mail records are demo data. Do not replace them with real user
  mail, production customer content, wallet secrets, private keys, seed phrases,
  or live identifiers.
- Provenance values are shown so users can inspect trust signals, but raw
  message body content should not be copied into proof payload summaries.
- Copy buttons should only copy the specific identifier displayed in the
  provenance row, not the full message or hidden metadata.
- AI summary and draft-reply copy in `RightPanel.tsx` is local demo behavior.
  Do not imply a live model, live mailbox, or live sending path unless a future
  integration issue explicitly adds it.
- Sender conversion and trust badges are security-sensitive. Changes should be
  reviewed alongside `EmailTrustBadges.tsx` and `trust-state.ts`.
- Attachment preview state should use the existing metadata-only contract:
  `{ name, size, type }`.

## QA Checklist

Before opening a PR in this area:

- [ ] Selecting a different message resets open reply state.
- [ ] Empty reader state does not render stale sender or provenance data.
- [ ] Header actions are disabled or no-op when no message is selected.
- [ ] Inline reply validation still blocks missing recipients, body, or postage.
- [ ] Attachment preview sends only metadata to the drawer callback.
- [ ] Read receipt actions do not appear for unrelated messages.
- [ ] Provenance copy actions show success feedback and do not copy message body.
- [ ] Provenance inspector opens and closes without changing message state.
- [ ] Right-panel quick actions are disabled when `email` is null.
- [ ] Keyboard focus remains usable for reply menu, copy buttons, and inspector controls.

## Suggested Validation

Run the narrowest checks available in your local environment:

```bash
# Mail trust/provenance-adjacent local test
npx vitest run src/components/mail/trust-state.test.ts

# Type and lint checks when dependencies are installed
bun x tsc --noEmit
bun run lint
```

If local dependencies are unavailable, note that limitation in the pull request
and include a manual review of the files listed above.
