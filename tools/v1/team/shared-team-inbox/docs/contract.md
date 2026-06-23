# Shared Team Inbox Core Contract

## Inputs

`createSharedInboxService({ teamMembers })` accepts a synthetic team roster of
email-like addresses. The service exposes folder-local methods only:

- `ingestMessage(message)`
- `listMessages(filters)`
- `claimMessage(messageId, actor, note)`
- `releaseMessage(messageId, actor)`
- `updateStatus(messageId, actor, nextStatus)`
- `addInternalComment(messageId, actor, body)`
- `sendReply(messageId, actor, body)`

Messages require:

- `id`
- `deliveryProofHash`
- `sharedInboxAddress`
- `senderAddress`
- `subject`
- `body`
- optional `receivedAt`, `status`, and `assignee`

## Outputs

Read methods return cloned data so callers cannot mutate service state directly.
`ingestMessage` returns:

- `status`: `stored` or `duplicate`
- `loading`: always `false` for this synchronous local service
- `error`: `null` unless future async adapters are introduced
- `message`: normalized stored message

Mutation methods return the updated message, comment, or reply object.

## Loading States

This reference implementation is synchronous and in-memory, so every public
method returns with `loading: false`. A future durable adapter should expose
loading state at the hook/UI layer without changing this folder-local core
contract.

## Error States

The service throws `SharedInboxError` for:

- malformed messages
- unknown message ids
- actors outside the team roster
- invalid status transitions
- empty comments or replies
- replies attempted before a message is claimed

## Privacy And Network Rules

- No live network calls are made.
- No secrets, production messages, or user credentials are required.
- Fixtures use `.test` domains and synthetic delivery proof hashes.
- Replies are stored as local records only; no email is sent.
